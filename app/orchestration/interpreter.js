/**
 * INTERPRETER.JS - Sensor Data Interpretation Module
 * Translates raw sensor inputs into Lyria-compatible musical parameters
 * Optimized for ultra-low latency real-time rave experience with smooth transitions
 */

export class SensorInterpreter {
  constructor() {
    this.lastInterpretation = null;
    this.genreHistory = [];
    this.intensitySmoothing = 0.5; // Less smoothing for more responsive changes
    this.lastMagnitude = 0;
    this.transitionThreshold = 0.08; // MUCH lower threshold for instant transitions
    
    // Predefined RAVE-OPTIMIZED musical styles from Lyria documentation
    // ENHANCED FOR MAXIMUM ENERGY AND RESPONSIVENESS
    this.raveGenres = {
      'rave-techno': {
        base: 'Techno',
        instruments: ['303 Acid Bass', 'TR-909 Drum Machine', 'Dirty Synths', 'Crunchy Distortion'],
        moods: ['Upbeat', 'Fat Beats', 'Danceable', 'Huge Drop', 'Fast tempo'],
        bpmRange: [135, 150],
        densityRange: [0.7, 1.0],
        brightnessRange: [0.7, 1.0]
      },
      'acid-rave': {
        base: 'Acid House',
        instruments: ['303 Acid Bass', 'TR-909 Drum Machine', 'Dirty Synths', 'Buchla Synths'],
        moods: ['Danceable', 'Funky', 'Fat Beats', 'Psychedelic', 'Crunchy Distortion'],
        bpmRange: [128, 140],
        densityRange: [0.6, 0.9],
        brightnessRange: [0.6, 1.0]
      },
      'hardcore-rave': {
        base: 'Hardcore',
        instruments: ['Boomy Bass', 'TR-909 Drum Machine', 'Crunchy Distortion', 'Glitchy Effects'],
        moods: ['Upbeat', 'Huge Drop', 'Fast tempo', 'Virtuoso', 'Fat Beats'],
        bpmRange: [170, 190],
        densityRange: [0.8, 1.0],
        brightnessRange: [0.8, 1.0]
      },
      'drum-bass-rave': {
        base: 'Drum & Bass',
        instruments: ['Boomy Bass', '808 Hip Hop Beat', 'Glitchy Effects', 'Crunchy Distortion'],
        moods: ['Fast tempo', 'Huge Drop', 'Upbeat', 'Crunchy Distortion', 'Fat Beats'],
        bpmRange: [160, 180],
        densityRange: [0.7, 1.0],
        brightnessRange: [0.7, 1.0]
      },
      'trance-rave': {
        base: 'Trance',
        instruments: ['Spacey Synths', 'TR-909 Drum Machine', 'Synth Pads', 'Ethereal Ambience'],
        moods: ['Upbeat', 'Ethereal Ambience', 'Huge Drop', 'Psychedelic', 'Danceable'],
        bpmRange: [130, 145],
        densityRange: [0.6, 0.8],
        brightnessRange: [0.6, 0.9]
      },
      'electro-rave': {
        base: 'EDM',
        instruments: ['808 Hip Hop Beat', 'Dirty Synths', 'Glitchy Effects', 'Crunchy Distortion'],
        moods: ['Upbeat', 'Huge Drop', 'Fat Beats', 'Danceable', 'Fast tempo'],
        bpmRange: [125, 135],
        densityRange: [0.7, 0.9],
        brightnessRange: [0.7, 1.0]
      }
    };
  }

  // Main interpretation function - converts sensor data to musical parameters
  interpretSensorData(sensorData) {
    try {
      // Calculate smoothed magnitude for stability
      const rawMagnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
      const magnitude = this.applySmoothingFilter(rawMagnitude, this.lastMagnitude, this.intensitySmoothing);
      this.lastMagnitude = magnitude;

      // Normalize magnitude to 0-1 range with extended sensitivity
      const normalizedMagnitude = Math.min(magnitude, 5) / 5;

      // Generate style prompt with smooth transitions
      const stylePrompt = this.generateSmoothedStylePrompt(sensorData, normalizedMagnitude);
      
      // Generate Lyria configuration parameters
      const lyriaConfig = this.generateLyriaConfig(sensorData, normalizedMagnitude);
      
      // Generate weighted prompts for smooth transitions
      const weightedPrompts = this.generateWeightedPrompts(stylePrompt, normalizedMagnitude);

      const interpretation = {
        stylePrompt,
        weightedPrompts,
        lyriaConfig,
        magnitude: normalizedMagnitude,
        rawMagnitude,
        timestamp: Date.now(),
        sensorSource: sensorData.source,
        // Additional metadata for orchestrator
        hasTransition: this.detectStyleTransition(stylePrompt),
        intensity: this.categorizeIntensity(normalizedMagnitude),
        movement: this.analyzeMovementPattern(sensorData)
      };

      this.lastInterpretation = interpretation;
      return interpretation;

    } catch (error) {
      console.error('Sensor interpretation error:', error);
      return this.getDefaultInterpretation();
    }
  }

  // Apply smoothing filter to reduce abrupt changes
  applySmoothingFilter(current, previous, alpha) {
    return alpha * current + (1 - alpha) * previous;
  }

  // Generate RAVE-OPTIMIZED style prompt with HIGH-ENERGY genre transitions
  generateSmoothedStylePrompt(sensorData, normalizedMagnitude) {
    // ENHANCED GENRE SELECTION - ALWAYS RAVE-FOCUSED
    // Minimum energy baseline = acid-rave, maximum energy = hardcore-rave
    let selectedGenre;
    
    // More aggressive scaling - even small movements trigger energetic genres
    const energyLevel = Math.max(normalizedMagnitude * 1.3, 0.3); // Minimum 30% energy
    
    if (energyLevel < 0.4) {
      selectedGenre = 'acid-rave';  // No more ambient - start with acid rave!
    } else if (energyLevel < 0.55) {
      selectedGenre = 'electro-rave';
    } else if (energyLevel < 0.7) {
      selectedGenre = 'rave-techno';
    } else if (energyLevel < 0.85) {
      selectedGenre = 'trance-rave';
    } else if (energyLevel < 0.95) {
      selectedGenre = 'drum-bass-rave';
    } else {
      selectedGenre = 'hardcore-rave';  // Maximum energy
    }

    const genre = this.raveGenres[selectedGenre];
    let style = genre.base;

    // Add movement-specific instruments
    const instruments = this.selectInstrumentsByMovement(sensorData, genre.instruments);
    if (instruments.length > 0) {
      style += ', ' + instruments.slice(0, 2).join(', ');
    }

    // Add intensity-based moods
    const moods = this.selectMoodsByIntensity(normalizedMagnitude, genre.moods);
    if (moods.length > 0) {
      style += ', ' + moods.join(', ');
    }

    // Add tempo indication
    if (normalizedMagnitude > 0.8) {
      style += ', Fast tempo';
    } else if (normalizedMagnitude < 0.2) {
      style += ', Slow tempo';
    }

    // Store genre for transition detection
    this.genreHistory.push(selectedGenre);
    if (this.genreHistory.length > 5) {
      this.genreHistory.shift();
    }

    return style;
  }

  // Select instruments based on movement direction and type
  selectInstrumentsByMovement(sensorData, availableInstruments) {
    const instruments = [];
    const movementThreshold = 0.1; // ULTRA-SENSITIVE for instant rave response

    // X-axis movement (side-to-side) - bass instruments
    if (Math.abs(sensorData.x) > movementThreshold) {
      const bassInstruments = availableInstruments.filter(inst => 
        inst.toLowerCase().includes('bass') || 
        inst.toLowerCase().includes('808')
      );
      if (bassInstruments.length > 0) {
        instruments.push(bassInstruments[0]);
      }
    }

    // Y-axis movement (up-down) - harmonic instruments
    if (Math.abs(sensorData.y) > movementThreshold) {
      const harmonicInstruments = availableInstruments.filter(inst => 
        inst.toLowerCase().includes('synth') || 
        inst.toLowerCase().includes('pad') ||
        inst.toLowerCase().includes('piano')
      );
      if (harmonicInstruments.length > 0) {
        instruments.push(harmonicInstruments[0]);
      }
    }

    // Z-axis movement (forward-back) - percussive instruments
    if (Math.abs(sensorData.z) > movementThreshold) {
      const percussiveInstruments = availableInstruments.filter(inst => 
        inst.toLowerCase().includes('drum') || 
        inst.toLowerCase().includes('beat') ||
        inst.toLowerCase().includes('909')
      );
      if (percussiveInstruments.length > 0) {
        instruments.push(percussiveInstruments[0]);
      }
    }

    return [...new Set(instruments)]; // Remove duplicates
  }

  // Select moods based on intensity level
  selectMoodsByIntensity(intensity, availableMoods) {
    if (intensity < 0.3) {
      return availableMoods.filter(mood => 
        mood.toLowerCase().includes('ambient') ||
        mood.toLowerCase().includes('chill') ||
        mood.toLowerCase().includes('subdued')
      );
    } else if (intensity < 0.7) {
      return availableMoods.filter(mood => 
        mood.toLowerCase().includes('groove') ||
        mood.toLowerCase().includes('funky') ||
        mood.toLowerCase().includes('danceable')
      );
    } else {
      return availableMoods.filter(mood => 
        mood.toLowerCase().includes('upbeat') ||
        mood.toLowerCase().includes('drop') ||
        mood.toLowerCase().includes('fast')
      );
    }
  }

  // Generate ULTRA-RESPONSIVE Lyria configuration for MAXIMUM RAVE ENERGY
  generateLyriaConfig(sensorData, normalizedMagnitude) {
    // Enhanced energy scaling for instant rave response
    const energyLevel = Math.max(normalizedMagnitude * 1.4, 0.4); // Minimum 40% energy
    const currentGenre = this.getCurrentGenre(energyLevel);
    const genreData = this.raveGenres[currentGenre];
    
    // AGGRESSIVE BPM mapping - faster response to movement
    const bpmRange = genreData.bpmRange[1] - genreData.bpmRange[0];
    const bpm = Math.floor(
      genreData.bpmRange[0] + (energyLevel * bpmRange)
    );

    // ENHANCED DENSITY - always energetic, more responsive
    const baseDensity = Math.max(genreData.densityRange[0], 0.5); // Minimum 50% density
    const density = Math.min(
      baseDensity + (energyLevel * (genreData.densityRange[1] - baseDensity)),
      1.0
    );

    // BOOSTED BRIGHTNESS for rave energy
    const baseBrightness = Math.max(genreData.brightnessRange[0], 0.6); // Minimum 60% brightness
    const brightness = Math.min(
      baseBrightness + (energyLevel * (genreData.brightnessRange[1] - baseBrightness)),
      1.0
    );

    // LOWER GUIDANCE for more creative/chaotic rave energy  
    const movementVariance = this.calculateMovementVariance(sensorData);
    const guidance = Math.max(1.5, Math.min(2.5 + (movementVariance * 2.0), 4.0)); // Lower range

    // HIGHER TEMPERATURE for more variation and energy
    const temperature = 1.2 + (energyLevel * 0.8); // More randomness = more energy

    return {
      bpm,
      density: parseFloat(density.toFixed(3)),
      brightness: parseFloat(brightness.toFixed(3)),
      temperature: parseFloat(temperature.toFixed(3)),
      guidance: parseFloat(guidance.toFixed(3)),
      muteBass: false,
      muteDrums: false,
      onlyBassAndDrums: false
    };
  }

  // Generate weighted prompts for smooth style transitions
  generateWeightedPrompts(currentStyle, intensity) {
    if (!this.lastInterpretation) {
      return [{ text: currentStyle, weight: 1.0 }];
    }

    const lastStyle = this.lastInterpretation.stylePrompt;
    
    // Check if style change is significant enough for transition
    if (this.shouldTransition(currentStyle, lastStyle, intensity)) {
      // Create smooth transition with weighted prompts
      const transitionWeight = Math.min(intensity + 0.3, 0.8);
      return [
        { text: lastStyle, weight: parseFloat((1 - transitionWeight).toFixed(2)) },
        { text: currentStyle, weight: parseFloat(transitionWeight.toFixed(2)) }
      ];
    }

    return [{ text: currentStyle, weight: 1.0 }];
  }

  // Determine if style transition should occur
  shouldTransition(currentStyle, lastStyle, intensity) {
    if (!lastStyle || currentStyle === lastStyle) return false;
    
    // Only transition on significant intensity changes
    const intensityChange = Math.abs(intensity - (this.lastInterpretation?.magnitude || 0));
    return intensityChange > this.transitionThreshold;
  }

  // Get current RAVE genre based on energy intensity
  getCurrentGenre(intensity) {
    // Enhanced energy scaling matching generateSmoothedStylePrompt
    const energyLevel = Math.max(intensity * 1.3, 0.3);
    
    if (energyLevel < 0.4) return 'acid-rave';
    if (energyLevel < 0.55) return 'electro-rave';
    if (energyLevel < 0.7) return 'rave-techno';
    if (energyLevel < 0.85) return 'trance-rave';
    if (energyLevel < 0.95) return 'drum-bass-rave';
    return 'hardcore-rave';
  }

  // Calculate movement variance for guidance parameter
  calculateMovementVariance(sensorData) {
    const magnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
    
    // Simple variance estimation based on current vs previous
    if (this.lastInterpretation) {
      const lastMagnitude = this.lastInterpretation.rawMagnitude || 0;
      return Math.abs(magnitude - lastMagnitude) / 5; // Normalize to 0-1
    }
    
    return 0.5; // Default moderate variance
  }

  // Detect style transitions for orchestrator optimization
  detectStyleTransition(currentStyle) {
    if (!this.lastInterpretation) return false;
    return currentStyle !== this.lastInterpretation.stylePrompt;
  }

  // Categorize intensity for orchestrator decision making
  categorizeIntensity(magnitude) {
    if (magnitude < 0.2) return 'low';
    if (magnitude < 0.6) return 'medium';
    if (magnitude < 0.8) return 'high';
    return 'extreme';
  }

  // Analyze movement pattern for additional context
  analyzeMovementPattern(sensorData) {
    const xDominant = Math.abs(sensorData.x) > Math.abs(sensorData.y) && Math.abs(sensorData.x) > Math.abs(sensorData.z);
    const yDominant = Math.abs(sensorData.y) > Math.abs(sensorData.x) && Math.abs(sensorData.y) > Math.abs(sensorData.z);
    const zDominant = Math.abs(sensorData.z) > Math.abs(sensorData.x) && Math.abs(sensorData.z) > Math.abs(sensorData.y);

    if (xDominant) return 'side-to-side';
    if (yDominant) return 'up-down';
    if (zDominant) return 'forward-back';
    return 'multi-directional';
  }

  // Default RAVE interpretation for error cases - ALWAYS ENERGETIC
  getDefaultInterpretation() {
    return {
      stylePrompt: 'Acid House, 303 Acid Bass, TR-909 Drum Machine, Fat Beats, Danceable',
      weightedPrompts: [{ text: 'Acid House, 303 Acid Bass, Fat Beats, Danceable', weight: 1.0 }],
      lyriaConfig: {
        bpm: 135,           // Solid rave BPM
        density: 0.7,       // High energy density
        brightness: 0.8,    // Bright rave sound
        temperature: 1.5,   // More variation
        guidance: 2.5,      // Lower guidance for creativity
        muteBass: false,
        muteDrums: false,
        onlyBassAndDrums: false
      },
      magnitude: 0.5,       // Higher baseline energy
      rawMagnitude: 1.2,
      timestamp: Date.now(),
      hasTransition: false,
      intensity: 'medium',  // Medium baseline instead of low
      movement: 'energetic'
    };
  }

  // Get interpretation history for analysis
  getLastInterpretation() {
    return this.lastInterpretation;
  }

  // Reset interpreter state
  reset() {
    this.lastInterpretation = null;
    this.genreHistory = [];
    this.lastMagnitude = 0;
    console.log('Sensor interpreter reset');
  }
}

// Export singleton instance
export const sensorInterpreter = new SensorInterpreter(); 