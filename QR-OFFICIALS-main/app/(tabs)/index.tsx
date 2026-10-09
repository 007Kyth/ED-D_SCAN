import { useFocusEffect } from 'expo-router';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { getTeacherEventSummary, type TeacherEventSummary } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';

export default function Index() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [events, setEvents] = useState<TeacherEventSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!user) {
        setRole(null);
        setEvents([]);
        return () => { active = false; };
      }
      getProfile(user.id).then((profile) => {
        if (!active) return;
        const currentRole = profile?.role ?? 'student';
        setRole(currentRole);
        if (currentRole === 'teacher') {
          getTeacherEventSummary(user.id).then((list) => {
            if (active) setEvents(list);
          });
        } else {
          setEvents([]);
        }
      });
      return () => { active = false; };
    }, [user])
  );

  const totalCheckIns = events.reduce((sum, e) => sum + e.attendeeCount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <Header title="QR Attendance" />
          <Text style={styles.credit}>Develop by: Montesclaros D. Kyth Nielzn</Text>
        </View>

        <View style={styles.bodyContainer}>
          <View style={styles.heroSticker}>
            <View style={styles.heroAccent} />
            <Text style={styles.heroTitle}>School Event Attendance</Text>
            <Text style={styles.subtitle}>
              Scan QR Codes to record attendance during school activities.
            </Text>
          </View>

          {role === 'teacher' && (
            <View style={styles.eventsPanel}>
              <View style={styles.eventsHeader}>
                <Text style={styles.eventsTitle}>MY EVENTS</Text>
                <Text style={styles.eventsTotal}>{totalCheckIns} CHECK-INS</Text>
              </View>
              {events.length === 0 ? (
                <Text style={styles.eventsEmpty}>
                  No events yet. Create one in the Teacher tab.
                </Text>
              ) : (
                events.map((e) => (
                  <View key={e.eventId} style={styles.eventRow}>
                    <View style={styles.eventRowText}>
                      <Text style={styles.eventRowTitle}>{e.title}</Text>
                      <Text style={styles.eventRowCode}>{e.eventCode}</Text>
                    </View>
                    <View style={styles.eventRowCount}>
                      <Text style={styles.eventRowCountValue}>{e.attendeeCount}</Text>
                      <Text style={styles.eventRowCountLabel}>IN</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        <View style={styles.footerContainer}>
          <AppButton
            theme="primary"
            title="Scan QR Code"
            icon="qr-code-outline"
            onPress={() => router.push('/scan')}
          />
          <AppButton
            title="Attendance History"
            icon="time-outline"
            onPress={() => router.push('/history')}
          />
          <AppButton
            title="Profile"
            icon="person-outline"
            onPress={() => router.push('/profile')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1 },
  headerContainer: { alignItems: 'center', marginTop: 12 },
  credit: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  bodyContainer: { paddingHorizontal: 24, marginBottom: 16 },
  heroSticker: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.gridLine,
    borderRadius: 8,
    padding: 18,
  },
  heroAccent: {
    width: 44,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.primary,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  eventsPanel: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.gridLine,
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  eventsTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    color: COLORS.primary,
  },
  eventsTotal: {
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  eventsEmpty: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  eventRowText: { flex: 1, marginRight: 12 },
  eventRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  eventRowCode: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  eventRowCount: {
    minWidth: 46,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  eventRowCountValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  eventRowCountLabel: {
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  footerContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
});
