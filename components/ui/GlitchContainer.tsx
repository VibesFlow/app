import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Dimensions,
  Animated,
  Easing
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../theme';

interface GlitchLine {
  y: number;
  width: number;
  opacity: number;
  color: string;
  left: number;
  height: number;
}

interface GlitchContainerProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  intensity?: 'low' | 'medium' | 'high';
  animated?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  noiseOpacity?: number;
  glitchOnly?: boolean; // If true, only show glitch lines without a container
}

const { width, height } = Dimensions.get('window');

const GlitchContainer: React.FC<GlitchContainerProps> = ({
  children,
  style,
  intensity = 'medium',
  animated = true,
  backgroundColor = 'rgba(0,0,0,0.7)',
  borderColor = COLORS.primary,
  noiseOpacity = 0.05,
  glitchOnly = false,
}) => {
  // Animation values
  const [glitchAnim] = useState(new Animated.Value(0));
  
  // Generate random glitch lines based on intensity
  const glitchLines = useMemo(() => {
    const lineCount = 
      intensity === 'low' ? 5 :
      intensity === 'medium' ? 10 :
      15;
    
    return generateGlitchLines(lineCount);
  }, [intensity]);
  
  // Start glitch animation
  useEffect(() => {
    if (!animated) return;
    
    const animateGlitch = () => {
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
      ]).start();
    };
    
    // Randomly trigger glitch animation
    const glitchProbability = 
      intensity === 'low' ? 0.01 :
      intensity === 'medium' ? 0.02 :
      0.04;
    
    const glitchInterval = setInterval(() => {
      if (Math.random() < glitchProbability) {
        animateGlitch();
      }
    }, 2000);
    
    return () => clearInterval(glitchInterval);
  }, [animated, intensity, glitchAnim]);
  
  // Create random set of glitch lines
  function generateGlitchLines(count: number): GlitchLine[] {
    const lines: GlitchLine[] = [];
    for (let i = 0; i < count; i++) {
      const y = Math.random() * height;
      const lineWidth = Math.random() * 100 + 50;
      const opacity = Math.random() * 0.5 + 0.1;
      const colorIndex = Math.floor(Math.random() * 3);
      const color = 
        colorIndex === 0 ? COLORS.primary :
        colorIndex === 1 ? COLORS.secondary :
        COLORS.accent;
      const left = Math.random() * width;
      const lineHeight = Math.random() < 0.8 ? 1 : Math.random() * 3 + 1;
      
      lines.push({ 
        y, 
        width: lineWidth, 
        opacity, 
        color,
        left,
        height: lineHeight
      });
    }
    return lines;
  }
  
  // Only render glitch lines if needed
  if (glitchOnly) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent', borderWidth: 0 }, style]}>
        {glitchLines.map((line, index) => (
          <Animated.View 
            key={index}
            style={[
              styles.glitchLine,
              {
                top: line.y,
                width: line.width,
                height: line.height,
                left: glitchAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [line.left, line.left + (Math.random() * 20 - 10)]
                }),
                opacity: glitchAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [line.opacity, line.opacity * 2]
                }),
                backgroundColor: line.color,
              }
            ]}
          />
        ))}
        {children}
      </View>
    );
  }

  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor, 
          borderColor 
        }, 
        style
      ]}
    >
      {/* Background gradient */}
      <LinearGradient
        colors={['rgba(10,10,10,0.8)', 'rgba(0,0,0,0.9)']}
        style={styles.gradient}
      />
      
      {/* Glitch lines */}
      {glitchLines.map((line, index) => (
        <Animated.View 
          key={index}
          style={[
            styles.glitchLine,
            {
              top: line.y,
              width: line.width,
              height: line.height,
              left: glitchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [line.left, line.left + (Math.random() * 20 - 10)]
              }),
              opacity: glitchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, line.opacity * 2]
              }),
              backgroundColor: line.color,
            }
          ]}
        />
      ))}
      
      {/* Noise overlay */}
      <View 
        style={[
          styles.noiseOverlay,
          { opacity: noiseOpacity }
        ]} 
      />
      
      {/* Container contents */}
      <View style={styles.content}>
        {children}
      </View>
      
      {/* Border glitch effect */}
      <Animated.View
        style={[
          styles.borderGlitch,
          {
            borderColor,
            opacity: glitchAnim,
            transform: [
              { translateX: glitchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 3]
              })}
            ]
          }
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  glitchLine: {
    position: 'absolute',
    height: 1,
    zIndex: 2,
  },
  noiseOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 3,
  },
  content: {
    zIndex: 4,
  },
  borderGlitch: {
    position: 'absolute',
    left: -3,
    right: -3,
    top: -3,
    bottom: -3,
    borderWidth: 1,
    zIndex: 1,
  },
});

export default GlitchContainer; 