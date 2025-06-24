import React, { useState, useEffect } from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  Animated, 
  Easing,
  ViewStyle,
  TextStyle, 
  View
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../theme';
import * as Haptics from 'expo-haptics';

interface AcidButtonProps {
  text: string;
  onPress: () => void;
  type?: 'primary' | 'secondary' | 'accent';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  glitchIntensity?: 'none' | 'low' | 'medium' | 'high';
  icon?: React.ReactNode;
  uppercase?: boolean;
  showLoadingIndicator?: boolean;
  pulsate?: boolean;
}

const AcidButton: React.FC<AcidButtonProps> = ({
  text,
  onPress,
  type = 'primary',
  size = 'medium',
  disabled = false,
  style,
  textStyle,
  glitchIntensity = 'low',
  icon,
  uppercase = true,
  showLoadingIndicator = false,
  pulsate = false,
}) => {
  // State and animation values
  const [pulse] = useState(new Animated.Value(1));
  const [glitchAnim] = useState(new Animated.Value(0));
  const [isPressed, setIsPressed] = useState(false);
  const [displayText, setDisplayText] = useState(uppercase ? text.toUpperCase() : text);
  
  // Get color based on type
  const getColors = () => {
    switch(type) {
      case 'primary':
        return {
          border: COLORS.primary,
          text: COLORS.primary,
          glow: `rgba(0, 255, 65, ${isPressed ? 0.3 : 0.15})`,
          shadow: 'rgba(0, 255, 65, 0.5)',
        };
      case 'secondary':
        return {
          border: COLORS.secondary,
          text: COLORS.secondary,
          glow: `rgba(255, 0, 160, ${isPressed ? 0.3 : 0.15})`,
          shadow: 'rgba(255, 0, 160, 0.5)',
        };
      case 'accent':
        return {
          border: COLORS.accent,
          text: COLORS.accent,
          glow: `rgba(0, 204, 255, ${isPressed ? 0.3 : 0.15})`,
          shadow: 'rgba(0, 204, 255, 0.5)',
        };
      default:
        return {
          border: COLORS.primary,
          text: COLORS.primary,
          glow: `rgba(0, 255, 65, ${isPressed ? 0.3 : 0.15})`,
          shadow: 'rgba(0, 255, 65, 0.5)',
        };
    }
  };

  const colors = getColors();
  
  // Get padding based on size
  const getPadding = () => {
    switch(size) {
      case 'small':
        return { vertical: 8, horizontal: 16 };
      case 'medium':
        return { vertical: 12, horizontal: 24 };
      case 'large':
        return { vertical: 16, horizontal: 32 };
      default:
        return { vertical: 12, horizontal: 24 };
    }
  };

  const padding = getPadding();
  
  // Start pulse animation
  useEffect(() => {
    if (pulsate || showLoadingIndicator) {
      startPulseAnimation();
    } else {
      // Reset to default if not pulsating
      pulse.setValue(1);
    }
    
    return () => {
      pulse.stopAnimation();
    };
  }, [pulsate, showLoadingIndicator]);
  
  // Start glitch animation if intensity is not 'none'
  useEffect(() => {
    if (glitchIntensity === 'none') return;
    
    const glitchProbability = 
      glitchIntensity === 'low' ? 0.01 : 
      glitchIntensity === 'medium' ? 0.02 : 
      0.03;
      
    const glitchInterval = setInterval(() => {
      if (Math.random() < glitchProbability) {
        triggerGlitch();
      }
    }, 2000);
    
    return () => clearInterval(glitchInterval);
  }, [glitchIntensity]);
  
  // Pulse animation function
  const startPulseAnimation = () => {
    // Use more rapid pulsing when in loading mode
    const duration = showLoadingIndicator ? 800 : 1500;
    const pulseIntensity = showLoadingIndicator ? 1.08 : 1.05;
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: pulseIntensity,
          duration: duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };
  
  // Trigger a glitch animation
  const triggerGlitch = () => {
    // Create glitched text
    const glitchedText = createGlitchedText(text);
    setDisplayText(uppercase ? glitchedText.toUpperCase() : glitchedText);
    
    // Animate
    Animated.sequence([
      Animated.timing(glitchAnim, {
        toValue: 1,
        duration: 100,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
      Animated.timing(glitchAnim, {
        toValue: 0,
        duration: 100,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Reset text after animation
      setDisplayText(uppercase ? text.toUpperCase() : text);
    });
  };
  
  // Create glitched text by replacing random characters
  const createGlitchedText = (originalText: string) => {
    const glitchChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/\\`~01';
    let result = '';
    
    for (let i = 0; i < originalText.length; i++) {
      if (Math.random() < 0.3) {
        const randomIndex = Math.floor(Math.random() * glitchChars.length);
        result += glitchChars[randomIndex];
      } else {
        result += originalText[i];
      }
    }
    
    return result;
  };
  
  // Handle button press
  const handlePress = () => {
    if (disabled) return;
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };
  
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      disabled={disabled}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      style={[
        styles.button,
        {
          paddingVertical: padding.vertical,
          paddingHorizontal: padding.horizontal,
          borderColor: disabled ? COLORS.textTertiary : colors.border,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[colors.glow, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />
      
      <Animated.View 
        style={[
          styles.container,
          {
            transform: [{ scale: pulse }],
          }
        ]}
      >
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        
        {showLoadingIndicator && (
          <View style={styles.loadingContainer}>
            <Animated.View 
              style={[
                styles.loadingDot,
                {
                  opacity: Animated.multiply(pulse, 0.8),
                  backgroundColor: colors.text,
                  transform: [{ scale: Animated.multiply(pulse, 1.2) }]
                }
              ]} 
            />
            <Animated.View 
              style={[
                styles.loadingDot,
                {
                  opacity: Animated.multiply(pulse, 0.9),
                  backgroundColor: colors.text,
                  transform: [{ scale: Animated.multiply(pulse, 1.4) }]
                }
              ]} 
            />
            <Animated.View 
              style={[
                styles.loadingDot,
                {
                  opacity: pulse,
                  backgroundColor: colors.text,
                  transform: [{ scale: Animated.multiply(pulse, 1.6) }]
                }
              ]} 
            />
          </View>
        )}
        
        <Animated.Text
          style={[
            styles.text,
            {
              color: disabled ? COLORS.textTertiary : colors.text,
              marginLeft: icon ? 8 : 0,
              textShadowColor: isPressed ? colors.shadow : 'transparent',
              textShadowRadius: isPressed ? 5 : 0,
            },
            textStyle,
          ]}
        >
          {displayText}
        </Animated.Text>
      </Animated.View>
      
      {/* Glitch overlay */}
      <Animated.View
        style={[
          styles.glitchOverlay,
          {
            opacity: glitchAnim,
            transform: [
              { translateX: glitchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, Math.random() > 0.5 ? 3 : -3]
              })}
            ]
          }
        ]}
      >
        <Text
          style={[
            styles.text,
            {
              color: type === 'primary' ? COLORS.accent : 
                    type === 'secondary' ? COLORS.primary : 
                    COLORS.secondary,
              marginLeft: icon ? 8 : 0,
            },
            textStyle,
          ]}
        >
          {displayText}
        </Text>
      </Animated.View>
      
      {isPressed && (
        <View
          style={[
            styles.flashOverlay,
            { backgroundColor: colors.glow }
          ]}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    overflow: 'hidden',
    position: 'relative',
  },
  gradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  iconContainer: {
    marginRight: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  loadingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  glitchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.2,
  },
});

export default AcidButton; 