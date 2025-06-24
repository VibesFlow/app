import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../../theme';

interface ButtonProps {
  text: string;
  onPress: () => void;
  type?: 'primary' | 'secondary' | 'accent';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Button: React.FC<ButtonProps> = ({
  text,
  onPress,
  type = 'primary',
  size = 'medium',
  disabled = false,
  style,
  textStyle,
}) => {
  const getButtonStyle = () => {
    const baseStyle: any[] = [styles.button];
    
    // Add size styles
    switch (size) {
      case 'small':
        baseStyle.push(styles.small);
        break;
      case 'large':
        baseStyle.push(styles.large);
        break;
      default:
        baseStyle.push(styles.medium);
    }
    
    // Add type styles
    switch (type) {
      case 'secondary':
        baseStyle.push(styles.secondary);
        break;
      case 'accent':
        baseStyle.push(styles.accent);
        break;
      default:
        baseStyle.push(styles.primary);
    }
    
    if (disabled) {
      baseStyle.push(styles.disabled);
    }
    
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle: any[] = [styles.text];
    
    // Add size text styles
    switch (size) {
      case 'small':
        baseStyle.push(styles.smallText);
        break;
      case 'large':
        baseStyle.push(styles.largeText);
        break;
      default:
        baseStyle.push(styles.mediumText);
    }
    
    // Add color text styles
    switch (type) {
      case 'secondary':
        baseStyle.push(styles.secondaryText);
        break;
      case 'accent':
        baseStyle.push(styles.accentText);
        break;
      default:
        baseStyle.push(styles.primaryText);
    }
    
    if (disabled) {
      baseStyle.push(styles.disabledText);
    }
    
    return baseStyle;
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <Text style={[getTextStyle(), textStyle]}>{text}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  
  // Sizes
  small: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  medium: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  large: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  
  // Types
  primary: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(0, 255, 65, 0.1)',
  },
  secondary: {
    borderColor: COLORS.secondary,
    backgroundColor: 'rgba(255, 0, 160, 0.1)',
  },
  accent: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(0, 204, 255, 0.1)',
  },
  
  disabled: {
    opacity: 0.5,
  },
  
  // Text styles
  text: {
    fontWeight: '700',
    letterSpacing: 2,
  },
  
  smallText: {
    fontSize: FONT_SIZES.sm,
  },
  mediumText: {
    fontSize: FONT_SIZES.md,
  },
  largeText: {
    fontSize: FONT_SIZES.lg,
  },
  
  primaryText: {
    color: COLORS.primary,
  },
  secondaryText: {
    color: COLORS.secondary,
  },
  accentText: {
    color: COLORS.accent,
  },
  disabledText: {
    color: COLORS.muted,
  },
});

export default Button;