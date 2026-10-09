import { supabase } from './supabase';
import { getEventByCode } from './events';
import { parseQRPayload } from './qr';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;
  attendees: {
    studentId: string;
    scannedAt: string;
    studentName?: string | null;
  }[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload); // 1. validate format
  if (!parsed.ok) {
    return { success: false, message: parsed.message };
  }
  const payload = parsed.payload;

  // 2. time window — allow a little slack so device-clock skew and the
  // minutes around an event don't block students from checking in.
  const now = Date.now();
  const start = payload.start ? new Date(payload.start).getTime() : null;
  const end = payload.end ? new Date(payload.end).getTime() : null;

  if (start && now < start - GRACE_BEFORE_MS) {
    return {
      success: false,
      message: `Event hasn't started yet (check-in opens ${prettyTime(payload.start)}).`,
    };
  }
  if (end && now > end + GRACE_AFTER_MS) {
    return {
      success: false,
      message: `Event already ended (check-in closed ${prettyTime(payload.end)}).`,
    };
  }

  const title = payload.title ?? payload.event;
  let event: { id: string; title: string } | null = null;

  const foundEvent = await getEventByCode(payload.event); // 3. find in cloud
  if (foundEvent) {
    // Don't let the event organizer pollute their own attendance count by
    // test-scanning their QR with the same account.
    if (foundEvent.created_by === studentId) {
      return {
        success: false,
        message: 'You are the organizer of this event — students can scan this QR to check in.',
        eventTitle: foundEvent.title,
      };
    }
    event = { id: foundEvent.id, title: foundEvent.title };
  } else {
    // 3b. not found → create it
    const { data: newEvent, error: insertError } = await supabase
      .from('events')
      .insert([
        {
          event_code: payload.event,
          title,
          start_time: payload.start ?? null,
          end_time: payload.end ?? null,
        },
      ])
      .select('id, title')
      .single();
    if (insertError) {
      return { success: false, message: 'Could not create event.' };
    }
    event = newEvent;
  }

  // 4. record attendance
  const { error: attError } = await supabase.from('attendance').insert([
    { student_id: studentId, event_id: event.id },
  ]);

  if (attError) {
    if (attError.code === '23505') {
      // 5. duplicate
      return {
        success: false,
        message: `Already checked in for "${event.title}".`,
        eventTitle: event.title,
      };
    }
    return { success: false, message: attError.message, eventTitle: event.title };
  }

  return {
    success: true,
    message: `Checked in for "${event.title}"!`,
    eventTitle: event.title,
  };
}

// How early (before start) and how late (after end) we still allow a check-in.
const GRACE_BEFORE_MS = 15 * 60 * 1000; // 15 minutes early
const GRACE_AFTER_MS = 60 * 60 * 1000; // 1 hour after the end time

function prettyTime(iso: string | undefined): string {
  if (!iso) return 'the scheduled time';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return 'the scheduled time';
  }
}

/** Live count of students who checked in to the event with this code. */
export async function getEventScanCount(code: string): Promise<number> {
  if (!code) return 0;
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('event_code', code)
    .maybeSingle();
  if (!event) return 0;
  const { count, error } = await supabase
    .from('attendance')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event.id);
  if (error) return 0;
  return count ?? 0;
}

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, events ( event_code, title )')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    eventId: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? '',
    scannedAt: row.scanned_at,
  }));
}

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events) return [];

  const eventIds = events.map((e: any) => e.id);
  if (eventIds.length === 0) return [];

  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .select('student_id, scanned_at, event_id')
    .in('event_id', eventIds)
    .order('scanned_at', { ascending: false });

  if (attError || !attendance) {
    return (events as any[]).map((e) => toEventSummary(e, []));
  }

  const rows = attendance as {
    student_id: string;
    scanned_at: string;
    event_id: string;
  }[];
  const studentIds = Array.from(new Set(rows.map((a) => a.student_id)));

  // NOTE: there is no FK from attendance.student_id to public.profiles, so
  // PostgREST cannot embed profiles inside the attendance query (PGRST200).
  // Fetch display names separately and merge in memory instead.
  const nameById: Record<string, string | null> = {};
  if (studentIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', studentIds);
    for (const p of (profiles ?? []) as {
      id: string;
      full_name: string | null;
      email: string | null;
    }[]) {
      nameById[p.id] = p.full_name ?? p.email ?? null;
    }
  }

  return (events as any[]).map((e) => {
    const list = rows.filter((a) => a.event_id === e.id);
    return toEventSummary(
      e,
      list.map((a) => ({
        studentId: a.student_id,
        scannedAt: a.scanned_at,
        studentName: nameById[a.student_id] ?? null,
      }))
    );
  });
}

function toEventSummary(
  e: any,
  attendees: TeacherEventAttendance['attendees']
): TeacherEventAttendance {
  return {
    eventId: e.id,
    eventCode: e.event_code,
    title: e.title,
    startTime: e.start_time,
    endTime: e.end_time,
    attendeeCount: attendees.length,
    attendees,
  };
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  // 1. Get the teacher's events (id + code + title)
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events) return [];

  const eventIds = events.map((e: any) => e.id);
  if (eventIds.length === 0) return []; // 2. no events → []

  // 3. Lightweight count fetch: only event_id per attendance row
  const { data: attRows, error: attError } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError) {
    return events.map((e: any) => ({
      eventId: e.id,
      eventCode: e.event_code,
      title: e.title,
      attendeeCount: 0,
    }));
  }

  // 4. Count how many rows point at each event
  const counts: Record<string, number> = {};
  (attRows ?? []).forEach((r: any) => {
    counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
  });

  // 5. Build the summary list
  return events.map((e: any) => ({
    eventId: e.id,
    eventCode: e.event_code,
    title: e.title,
    attendeeCount: counts[e.id] ?? 0,
  }));
}