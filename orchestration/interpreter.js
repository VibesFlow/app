/**
 * INTERPRETER.JS - Sensor Data Interpretation Module
 * Translates raw sensor inputs into Lyria-compatible musical parameters
 * Optimized for ultra-low latency real-time rave experience with smooth transitions
 */

export class SensorInterpreter {
  constructor() {
    this.lastInterpretation = null;
    this.genreHistory = [];
    this.intensitySmoothing = 0.2; // Much less smoothing for ultra-responsive changes
    this.lastMagnitude = 0;
    this.transitionThreshold = 0.02; // Ultra-low threshold for instant micro-transitions
    
    // Enhanced micro-movement detection
    this.microMovementThreshold = 0.005; // Detect extremely subtle movements
    this.accelerationSensitivity = 0.001; // Detect tiny accelerations
    this.velocityHistory = [];
    this.maxHistoryLength = 10;
    
    // Predefined RAVE-OPTIMIZED musical styles from Lyria documentation
    // ENHANCED FOR MAXIMUM ENERGY, RESPONSIVENESS, AND PSYCHEDELIC VARIETY
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
      'psychedelic-techno': {
        base: 'Techno',
        instruments: ['Buchla Synths', 'Moog Synths', 'Resonant Filters', 'Delay Effects', 'Reverb'],
        moods: ['Psychedelic', 'Dreamy', 'Ethereal', 'Spacey', 'Trippy'],
        bpmRange: [125, 135],
        densityRange: [0.4, 0.8],
        brightnessRange: [0.3, 0.9]
      },
      'minimal-acid': {
        base: 'Minimal Techno',
        instruments: ['303 Acid Bass', 'Subtle Percussion', 'Clean Distortion', 'Filter Sweeps'],
        moods: ['Minimal', 'Hypnotic', 'Clean', 'Subtle', 'Evolving'],
        bpmRange: [120, 130],
        densityRange: [0.3, 0.6],
        brightnessRange: [0.4, 0.8]
      },
      'hardcore-rave': {
        base: 'Hardcore',
        instruments: ['Boomy Bass', 'TR-909 Drum Machine', 'Crunchy Distortion', 'Glitchy Effects'],
        moods: ['Upbeat', 'Huge Drop', 'Fast tempo', 'Virtuoso', 'Fat Beats'],
        bpmRange: [170, 190],
        densityRange: [0.8, 1.0],
        brightnessRange: [0.8, 1.0]
      },
      'ambient-techno': {
        base: 'Ambient Techno',
        instruments: ['Atmospheric Pads', 'Subtle Beats', 'Texture Synths', 'Clean Reverb'],
        moods: ['Ambient', 'Atmospheric', 'Dreamy', 'Spacey', 'Evolving'],
        bpmRange: [100, 120],
        densityRange: [0.2, 0.5],
        brightnessRange: [0.2, 0.7]
      },
      'glitch-techno': {
        base: 'Glitch',
        instruments: ['Glitchy Effects', 'Digital Distortion', 'Stuttering Beats', 'Granular Synths'],
        moods: ['Glitchy', 'Digital', 'Stuttering', 'Broken', 'Experimental'],
        bpmRange: [130, 145],
        densityRange: [0.6, 0.9],
        brightnessRange: [0.5, 1.0]
      },
      'progressive-house': {
        base: 'Progressive House',
        instruments: ['Warm Bass', 'Lush Pads', 'Organic Percussion', 'Melodic Synths'],
        moods: ['Progressive', 'Melodic', 'Warm', 'Emotional', 'Building'],
        bpmRange: [118, 128],
        densityRange: [0.5, 0.8],
        brightnessRange: [0.6, 0.9]
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
      // Enhanced magnitude calculation with micro-movement detection
      const rawMagnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
      
      // Track velocity and acceleration for enhanced responsiveness
      this.trackVelocityHistory(sensorData);
      const velocityMagnitude = this.calculateVelocityMagnitude(sensorData);
      const accelerationMagnitude = this.calculateAccelerationMagnitude(sensorData);
      
      // Combine movement types for comprehensive responsiveness
      const combinedMagnitude = rawMagnitude + (velocityMagnitude * 0.5) + (accelerationMagnitude * 0.3);
      const magnitude = this.applySmoothingFilter(combinedMagnitude, this.lastMagnitude, this.intensitySmoothing);
      this.lastMagnitude = magnitude;

      // Enhanced normalization with extended sensitivity range
      const normalizedMagnitude = Math.min(magnitude, 8) / 8; // Increased range for more variety

      // Detect micro-movements for subtle musical changes
      const isMicroMovement = this.detectMicroMovement(rawMagnitude, velocityMagnitude, accelerationMagnitude);
      const isAccelerating = accelerationMagnitude > this.accelerationSensitivity;

      // Generate enhanced style prompt with psychedelic variety
      const stylePrompt = this.generateEnhancedStylePrompt(sensorData, normalizedMagnitude, isMicroMovement, isAccelerating);
      
      // Generate enhanced Lyria configuration parameters
      const lyriaConfig = this.generateEnhancedLyriaConfig(sensorData, normalizedMagnitude, isMicroMovement, isAccelerating);
      
      // Generate weighted prompts for smooth transitions
      const weightedPrompts = this.generateWeightedPrompts(stylePrompt, normalizedMagnitude);

      const interpretation = {
        stylePrompt,
        weightedPrompts,
        lyriaConfig,
        magnitude: normalizedMagnitude,
        rawMagnitude,
        velocityMagnitude,
        accelerationMagnitude,
        isMicroMovement,
        isAccelerating,
        timestamp: Date.now(),
        sensorSource: sensorData.source,
        // Enhanced metadata for orchestrator
        hasTransition: this.detectStyleTransition(stylePrompt),
        intensity: this.categorizeEnhancedIntensity(normalizedMagnitude, isMicroMovement, isAccelerating),
        movement: this.analyzeEnhancedMovementPattern(sensorData, velocityMagnitude, accelerationMagnitude)
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

  // Track velocity history for enhanced responsiveness
  trackVelocityHistory(sensorData) {
    if (sensorData.velocity) {
      this.velocityHistory.push(sensorData.velocity);
      if (this.velocityHistory.length > this.maxHistoryLength) {
        this.velocityHistory.shift();
      }
    }
  }

  // Calculate velocity magnitude from sensor data
  calculateVelocityMagnitude(sensorData) {
    if (sensorData.velocity) {
      return Math.sqrt(sensorData.velocity.x ** 2 + sensorData.velocity.y ** 2);
    }
    return 0;
  }

  // Calculate acceleration magnitude from sensor data
  calculateAccelerationMagnitude(sensorData) {
    if (sensorData.acceleration) {
      return Math.sqrt(sensorData.acceleration.x ** 2 + sensorData.acceleration.y ** 2);
    }
    return 0;
  }

  // Detect micro-movements for subtle musical changes
  detectMicroMovement(rawMagnitude, velocityMagnitude, accelerationMagnitude) {
    return rawMagnitude > this.microMovementThreshold ||
           velocityMagnitude > this.microMovementThreshold ||
           accelerationMagnitude > this.accelerationSensitivity;
  }

  // Generate enhanced style prompt with psychedelic variety
  generateEnhancedStylePrompt(sensorData, normalizedMagnitude, isMicroMovement, isAccelerating) {
    let selectedGenre;

    // Enhanced genre selection based on movement characteristics
    if (isAccelerating && normalizedMagnitude > 0.7) {
      // High energy, fast movements - hardcore/glitch
      selectedGenre = this.selectFromGenres(['hardcore-rave', 'glitch-techno', 'rave-techno']);
    } else if (isMicroMovement && normalizedMagnitude < 0.3) {
      // Subtle movements - psychedelic/ambient
      selectedGenre = this.selectFromGenres(['psychedelic-techno', 'ambient-techno', 'minimal-acid']);
    } else if (normalizedMagnitude > 0.5) {
      // Medium-high energy - main rave genres
      selectedGenre = this.selectFromGenres(['acid-rave', 'rave-techno', 'progressive-house']);
    } else {
      // Low energy - chill/progressive
      selectedGenre = this.selectFromGenres(['minimal-acid', 'ambient-techno', 'progressive-house']);
    }

    const genre = this.raveGenres[selectedGenre];
    
    // Enhanced instrument selection based on movement
    const selectedInstruments = this.selectEnhancedInstrumentsByMovement(sensorData, genre.instruments, isMicroMovement, isAccelerating);
    
    // Enhanced mood selection
    const selectedMoods = this.selectEnhancedMoodsByIntensity(genre.moods, normalizedMagnitude, isMicroMovement);

    return `${genre.base} with ${selectedInstruments.join(', ')} creating ${selectedMoods.join(', ')} vibes`;
  }

  // Generate enhanced Lyria configuration with micro-movement responsiveness
  generateEnhancedLyriaConfig(sensorData, normalizedMagnitude, isMicroMovement, isAccelerating) {
    const selectedGenreName = this.selectGenreByMovement(normalizedMagnitude, isMicroMovement, isAccelerating);
    const genre = this.raveGenres[selectedGenreName];

    // Enhanced BPM calculation with acceleration influence
    let baseBpm = genre.bpmRange[0] + (genre.bpmRange[1] - genre.bpmRange[0]) * normalizedMagnitude;
    if (isAccelerating) {
      baseBpm += 5; // Boost BPM for acceleration
    }
    if (isMicroMovement && normalizedMagnitude < 0.2) {
      baseBpm -= 3; // Reduce BPM for subtle movements
    }

    // Enhanced density with micro-movement sensitivity
    let baseDensity = genre.densityRange[0] + (genre.densityRange[1] - genre.densityRange[0]) * normalizedMagnitude;
    if (isMicroMovement) {
      baseDensity *= 0.8; // Reduce density for subtle movements
    }

    // Enhanced brightness with movement characteristics
    let baseBrightness = genre.brightnessRange[0] + (genre.brightnessRange[1] - genre.brightnessRange[0]) * normalizedMagnitude;
    if (sensorData.source === 'camera-enhanced' && sensorData.motionDirection) {
      baseBrightness += sensorData.motionDirection.magnitude * 0.2; // Camera motion influences brightness
    }

    // Enhanced guidance with responsiveness
    let guidance = 0.3 + normalizedMagnitude * 0.4; // Base guidance
    if (isAccelerating) {
      guidance += 0.1; // More guidance for fast movements
    }

    return {
      bpm: Math.round(Math.max(80, Math.min(200, baseBpm))),
      density: Math.max(0.1, Math.min(1.0, baseDensity)),
      brightness: Math.max(0.0, Math.min(1.0, baseBrightness)),
      guidance: Math.max(0.1, Math.min(0.8, guidance))
    };
  }

  // Enhanced intensity categorization
  categorizeEnhancedIntensity(normalizedMagnitude, isMicroMovement, isAccelerating) {
    if (isAccelerating && normalizedMagnitude > 0.8) return 'explosive';
    if (normalizedMagnitude > 0.7) return 'intense';
    if (normalizedMagnitude > 0.5) return 'energetic';
    if (normalizedMagnitude > 0.3) return 'moderate';
    if (isMicroMovement) return 'subtle';
    return 'ambient';
  }

  // Enhanced movement pattern analysis
  analyzeEnhancedMovementPattern(sensorData, velocityMagnitude, accelerationMagnitude) {
    const pattern = {
      type: 'unknown',
      direction: { x: 0, y: 0, z: 0 },
      intensity: 0,
      characteristics: []
    };

    // Analyze movement type
    if (accelerationMagnitude > this.accelerationSensitivity) {
      pattern.type = 'acceleration';
      pattern.characteristics.push('accelerating');
    } else if (velocityMagnitude > this.microMovementThreshold) {
      pattern.type = 'velocity';
      pattern.characteristics.push('flowing');
    } else {
      pattern.type = 'position';
      pattern.characteristics.push('static');
    }

    // Enhanced direction analysis
    pattern.direction = {
      x: sensorData.x || 0,
      y: sensorData.y || 0,
      z: sensorData.z || 0
    };

    // Calculate pattern intensity
    pattern.intensity = Math.sqrt(
      pattern.direction.x ** 2 + 
      pattern.direction.y ** 2 + 
      pattern.direction.z ** 2
    );

    // Add movement characteristics
    if (pattern.intensity > 0.5) pattern.characteristics.push('dynamic');
    if (Math.abs(pattern.direction.x) > Math.abs(pattern.direction.y)) {
      pattern.characteristics.push('horizontal');
    } else {
      pattern.characteristics.push('vertical');
    }

    return pattern;
  }

  // Select from specific genres
  selectFromGenres(genreNames) {
    return genreNames[Math.floor(Math.random() * genreNames.length)];
  }

  // Select genre based on movement characteristics
  selectGenreByMovement(normalizedMagnitude, isMicroMovement, isAccelerating) {
    if (isAccelerating && normalizedMagnitude > 0.7) {
      return this.selectFromGenres(['hardcore-rave', 'glitch-techno']);
    } else if (isMicroMovement && normalizedMagnitude < 0.3) {
      return this.selectFromGenres(['psychedelic-techno', 'ambient-techno', 'minimal-acid']);
    } else if (normalizedMagnitude > 0.5) {
      return this.selectFromGenres(['acid-rave', 'rave-techno']);
    } else {
      return this.selectFromGenres(['progressive-house', 'minimal-acid']);
    }
  }

  // Enhanced instrument selection based on movement
  selectEnhancedInstrumentsByMovement(sensorData, availableInstruments, isMicroMovement, isAccelerating) {
    const instruments = [];
    const movementThreshold = 0.02; // Much lower threshold for micro-movements

    if (isAccelerating) {
      // For acceleration, prefer driving instruments
      const drivingInstruments = availableInstruments.filter(inst => 
        inst.toLowerCase().includes('bass') || 
        inst.toLowerCase().includes('909') ||
        inst.toLowerCase().includes('distortion')
      );
      instruments.push(...drivingInstruments.slice(0, 2));
    }

    if (isMicroMovement) {
      // For subtle movements, prefer atmospheric instruments
      const atmosphericInstruments = availableInstruments.filter(inst => 
        inst.toLowerCase().includes('synth') || 
        inst.toLowerCase().includes('pad') ||
        inst.toLowerCase().includes('reverb') ||
        inst.toLowerCase().includes('delay')
      );
      instruments.push(...atmosphericInstruments.slice(0, 2));
    }

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
        inst.toLowerCase().includes('moog') ||
        inst.toLowerCase().includes('buchla')
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

    // Ensure we have at least one instrument
    if (instruments.length === 0) {
      instruments.push(availableInstruments[0]);
    }

    return [...new Set(instruments)]; // Remove duplicates
  }

  // Enhanced mood selection based on intensity and movement
  selectEnhancedMoodsByIntensity(availableMoods, normalizedMagnitude, isMicroMovement) {
    const moods = [];

    if (normalizedMagnitude > 0.7) {
      // High intensity moods
      const highEnergyMoods = availableMoods.filter(mood => 
        mood.toLowerCase().includes('upbeat') ||
        mood.toLowerCase().includes('fast') ||
        mood.toLowerCase().includes('huge') ||
        mood.toLowerCase().includes('fat')
      );
      moods.push(...highEnergyMoods.slice(0, 2));
    }

    if (isMicroMovement || normalizedMagnitude < 0.3) {
      // Subtle/psychedelic moods
      const subtleMoods = availableMoods.filter(mood => 
        mood.toLowerCase().includes('psychedelic') ||
        mood.toLowerCase().includes('dreamy') ||
        mood.toLowerCase().includes('ambient') ||
        mood.toLowerCase().includes('ethereal') ||
        mood.toLowerCase().includes('spacey')
      );
      moods.push(...subtleMoods.slice(0, 2));
    }

    if (moods.length === 0) {
      // Fallback to first available moods
      moods.push(...availableMoods.slice(0, 2));
    }

    return [...new Set(moods)]; // Remove duplicates
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