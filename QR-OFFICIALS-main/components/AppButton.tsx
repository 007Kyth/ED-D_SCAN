import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme?: 'primary';
  onPress: () => void;
  disabled?: boolean;
};

export default function AppButton({ title, icon, theme, onPress, disabled }: Props) {
  const [hovered, setHovered] = useState(false);
  const isPrimary = theme === 'primary';

  return (
    <Pressable
      style={({ pressed }) => {
        const active = pressed || hovered;
        return [
          styles.base,
          styles.button,
          isPrimary ? styles.primaryGlow : styles.secondaryButton,
          isPrimary && active && {
            backgroundColor: COLORS.primaryDeep,
            borderColor: COLORS.primaryDeep,
          },
          !isPrimary && (active || hovered) && { backgroundColor: COLORS.surface },
          active && styles.depressed,
        ];
      }}
      onPress={onPress}
      onPressIn={() => setHovered(true)}
      onPressOut={() => setHovered(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      disabled={disabled}
    >
      {({ pressed }) => {
        const active = pressed || hovered;
        const iconColor = isPrimary
          ? COLORS.textOnPrimary
          : active ? COLORS.primary : COLORS.textSecondary;
        const labelColor = isPrimary
          ? COLORS.textOnPrimary
          : active ? COLORS.primaryDeep : COLORS.textPrimary;
        return (
          <>
            <Ionicons name={icon} size={22} color={iconColor} style={styles.icon} />
            <Text style={[styles.label, { fontWeight: isPrimary ? '700' : '600', color: labelColor }]}>
              {title}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    marginBottom: 14,
  },
  button: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryGlow: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDeep,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  secondaryButton: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.gridLine,
    borderBottomWidth: 2,
  },
  depressed: {
    transform: [{ translateY: 2 }],
  },
  icon: { paddingRight: 10 },
  label: { fontSize: 17, color: COLORS.textPrimary },
});
