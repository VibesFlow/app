/**
 * INTERPRETER.JS - Sensor Data Interpretation Module
 * Translates raw sensor inputs into Lyria-compatible musical parameters
 * OPTIMIZED FOR MAXIMUM VARIETY with psychedelic elements and ultra-sensitive response
 */

// Ensure polyfills are loaded for platform compatibility (includes crypto wrapper)
import '../configs/polyfills';

export class SensorInterpreter {
  constructor() {
    this.lastInterpretation = null;
    this.genreHistory = [];
    this.intensitySmoothing = 0.3; // Reduced smoothing for more immediate response
    this.lastMagnitude = 0;
    this.transitionThreshold = 0.03; // ULTRA-LOW threshold for instant variety
    
    // EXPANDED PSYCHEDELIC RAVE GENRES with clean distortions and variety
    this.raveGenres = {
      'psychedelic-acid': {
        base: 'Psychedelic Acid House',
        instruments: ['303 Acid Bass', 'Spacey Synths', 'Swirling Phasers', 'Clean Distortion'],
        moods: ['Psychedelic', 'Dreamy', 'Ethereal Ambience', 'Hypnotic', 'Clean warped sounds'],
        bpmRange: [125, 138],
        densityRange: [0.5, 0.8],
        brightnessRange: [0.6, 0.9]
      },
      'dreamy-techno': {
        base: 'Dreamy Techno',
        instruments: ['Warm Synths', 'TR-909 Drum Machine', 'Ethereal Pads', 'Crystal Delays'],
        moods: ['Dreamy', 'Floating', 'Warm', 'Euphoric', 'Clean atmospheric'],
        bpmRange: [128, 142],
        densityRange: [0.6, 0.8],
        brightnessRange: [0.7, 0.9]
      },
      'cosmic-trance': {
        base: 'Cosmic Trance',
        instruments: ['Spacey Synths', 'Ethereal Pads', 'Crystal Arpeggios', 'Clean Reverbs'],
        moods: ['Cosmic', 'Transcendent', 'Otherworldly', 'Floating', 'Pure energy'],
        bpmRange: [132, 148],
        densityRange: [0.6, 0.9],
        brightnessRange: [0.8, 1.0]
      },
      'liquid-bass': {
        base: 'Liquid Drum & Bass',
        instruments: ['Liquid Bass', 'Crystal Percussion', 'Atmospheric Pads', 'Clean Modulation'],
        moods: ['Liquid', 'Flowing', 'Smooth', 'Organic', 'Clean dynamics'],
        bpmRange: [165, 180],
        densityRange: [0.7, 0.9],
        brightnessRange: [0.7, 1.0]
      },
      'ambient-dub': {
        base: 'Ambient Dub Techno',
        instruments: ['Deep Bass', 'Dub Delays', 'Atmospheric Textures', 'Clean Space'],
        moods: ['Ambient', 'Spacious', 'Deep', 'Meditative', 'Clean resonance'],
        bpmRange: [118, 130],
        densityRange: [0.4, 0.7],
        brightnessRange: [0.5, 0.8]
      },
      'forest-psytrance': {
        base: 'Forest Psytrance',
        instruments: ['Organic Synths', 'Natural Textures', 'Tribal Percussion', 'Clean Morphing'],
        moods: ['Organic', 'Wild', 'Natural', 'Primal', 'Clean evolution'],
        bpmRange: [145, 155],
        densityRange: [0.8, 1.0],
        brightnessRange: [0.6, 0.9]
      },
      'melodic-house': {
        base: 'Melodic House',
        instruments: ['Warm Piano', 'Melodic Synths', 'Clean Strings', 'Gentle Percussion'],
        moods: ['Melodic', 'Emotional', 'Uplifting', 'Warm', 'Clean harmony'],
        bpmRange: [120, 128],
        densityRange: [0.5, 0.8],
        brightnessRange: [0.7, 0.9]
      },
      'breakbeat-fusion': {
        base: 'Breakbeat Fusion',
        instruments: ['Funky Breaks', 'Jazz Elements', 'Vinyl Textures', 'Clean Cuts'],
        moods: ['Funky', 'Groove', 'Vintage', 'Creative', 'Clean sampling'],
        bpmRange: [125, 140],
        densityRange: [0.6, 0.9],
        brightnessRange: [0.6, 0.8]
      }
    };
  }

  // Main interpretation function - ULTRA-RESPONSIVE with maximum variety
  interpretSensorData(sensorData) {
    try {
      // Calculate smoothed magnitude with reduced smoothing for immediacy
      const rawMagnitude = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
      const magnitude = this.applySmoothingFilter(rawMagnitude, this.lastMagnitude, this.intensitySmoothing);
      this.lastMagnitude = magnitude;

      // Extended sensitivity range for micro-movements
      const normalizedMagnitude = Math.min(magnitude, 8) / 8; // Increased range

      // Generate DYNAMIC style prompt with constant variation
      const stylePrompt = this.generateDynamicStylePrompt(sensorData, normalizedMagnitude);
      
      // Generate VARIETY-OPTIMIZED Lyria configuration
      const lyriaConfig = this.generateVarietyOptimizedConfig(sensorData, normalizedMagnitude);
      
      // Generate COMPLEX weighted prompts for maximum variety
      const weightedPrompts = this.generateComplexWeightedPrompts(stylePrompt, normalizedMagnitude, sensorData);

      const interpretation = {
        stylePrompt,
        weightedPrompts,
        lyriaConfig,
        magnitude: normalizedMagnitude,
        rawMagnitude,
        timestamp: Date.now(),
        sensorSource: sensorData.source,
        hasTransition: this.detectVarietyTransition(stylePrompt),
        intensity: this.categorizeIntensity(normalizedMagnitude),
        movement: this.analyzeMovementPattern(sensorData),
        varietyFactor: this.calculateVarietyFactor(sensorData) // New variety metric
      };

      this.lastInterpretation = interpretation;
      return interpretation;

    } catch (error) {
      console.error('Sensor interpretation error:', error);
      return this.getVarietyDefaultInterpretation();
    }
  }

  // Apply smoothing filter to reduce abrupt changes
  applySmoothingFilter(current, previous, alpha) {
    return alpha * current + (1 - alpha) * previous;
  }

  // Generate DYNAMIC style prompts with constant variety and psychedelic elements
  generateDynamicStylePrompt(sensorData, normalizedMagnitude) {
    // MULTI-DIMENSIONAL genre selection for maximum variety
    const timeVariation = Math.sin(Date.now() / 2500) * 0.4; // Faster time variation
    const sensorVariation = Math.sin(sensorData.x * sensorData.y * 12) * 0.3; // Enhanced sensor variation
    const chaosVariation = Math.sin(Date.now() / 1000) * 0.2; // High-frequency chaos
    const energyLevel = Math.max(normalizedMagnitude + timeVariation + sensorVariation + chaosVariation, 0.1);
    
    let selectedGenre;
    
    // ULTRA-AGGRESSIVE genre selection with overlapping ranges for unpredictability
    if (energyLevel < 0.18) {
      selectedGenre = Math.random() < 0.7 ? 'ambient-dub' : 'melodic-house';
    } else if (energyLevel < 0.35) {
      const options = ['melodic-house', 'psychedelic-acid', 'ambient-dub'];
      selectedGenre = options[Math.floor(Math.random() * options.length)];
    } else if (energyLevel < 0.5) {
      const options = ['psychedelic-acid', 'dreamy-techno', 'breakbeat-fusion'];
      selectedGenre = options[Math.floor(Math.random() * options.length)];
    } else if (energyLevel < 0.65) {
      const options = ['dreamy-techno', 'breakbeat-fusion', 'cosmic-trance'];
      selectedGenre = options[Math.floor(Math.random() * options.length)];
    } else if (energyLevel < 0.78) {
      const options = ['breakbeat-fusion', 'cosmic-trance', 'liquid-bass'];
      selectedGenre = options[Math.floor(Math.random() * options.length)];
    } else if (energyLevel < 0.88) {
      const options = ['cosmic-trance', 'liquid-bass', 'forest-psytrance'];
      selectedGenre = options[Math.floor(Math.random() * options.length)];
    } else {
      const options = ['liquid-bass', 'forest-psytrance'];
      // High energy chaos - occasionally inject unexpected genres
      if (Math.random() < 0.2) {
        const allGenres = Object.keys(this.raveGenres);
        selectedGenre = allGenres[Math.floor(Math.random() * allGenres.length)];
      } else {
        selectedGenre = options[Math.floor(Math.random() * options.length)];
      }
    }

    const genre = this.raveGenres[selectedGenre];
    let style = genre.base;

    // Add ENHANCED psychedelic modifiers with clean distortions
    const psychedelicModifiers = [
      'Clean Morphing Distortion',
      'Ethereal Phase Shifting',
      'Crystalline Reverb Tails',
      'Organic Bit Crushing',
      'Liquid Frequency Modulation',
      'Spacial Chorus Waves',
      'Dream State Filtering',
      'Prismatic Delay Patterns',
      'Cosmic Ring Modulation',
      'Fluid Granular Synthesis'
    ];
    
    // AGGRESSIVE psychedelic injection
    if (normalizedMagnitude > 0.3) {
      const numModifiers = Math.min(Math.floor(normalizedMagnitude * 3) + 1, 3);
      const selectedModifiers = [];
      for (let i = 0; i < numModifiers; i++) {
        const modifier = psychedelicModifiers[Math.floor(Math.random() * psychedelicModifiers.length)];
        if (!selectedModifiers.includes(modifier)) {
          selectedModifiers.push(modifier);
        }
      }
      style += ', ' + selectedModifiers.join(', ');
    }

    // Add DYNAMIC movement-specific instruments with enhanced variety
    const instruments = this.selectDynamicInstruments(sensorData, genre.instruments, energyLevel);
    if (instruments.length > 0) {
      style += ', ' + instruments.slice(0, 4).join(', '); // More instruments for chaos
    }

    // Add ENHANCED PSYCHEDELIC mood layers
    const moods = this.selectEnhancedPsychedelicMoods(normalizedMagnitude, genre.moods, sensorData);
    if (moods.length > 0) {
      style += ', ' + moods.join(', ');
    }

    // Add TEMPORAL CHAOS elements
    const temporalElement = this.getEnhancedTemporalVariation(energyLevel);
    if (temporalElement) {
      style += ', ' + temporalElement;
    }

    // VARIETY INJECTION - random cross-genre contamination
    if (Math.random() < 0.15) { // 15% chance for cross-contamination
      const otherGenres = Object.keys(this.raveGenres).filter(g => g !== selectedGenre);
      const contaminantGenre = otherGenres[Math.floor(Math.random() * otherGenres.length)];
      const contaminant = this.raveGenres[contaminantGenre].instruments[0];
      style += ', ' + contaminant + ' influence';
    }

    // Store genre for variety tracking with enhanced history
    this.genreHistory.push(selectedGenre);
    if (this.genreHistory.length > 12) { // Extended history for better variety tracking
      this.genreHistory.shift();
    }

    return style;
  }

  // Select instruments with DYNAMIC variety and sensor responsiveness
  selectDynamicInstruments(sensorData, availableInstruments, energyLevel) {
    const instruments = [];
    const movementThreshold = 0.05; // ULTRA-SENSITIVE threshold
    
    // X-axis movement - harmonic/melodic instruments (ULTRA-SENSITIVE)
    if (Math.abs(sensorData.x) > movementThreshold) {
      const harmonicInstruments = availableInstruments.filter(inst => 
        inst.toLowerCase().includes('synth') || 
        inst.toLowerCase().includes('piano') ||
        inst.toLowerCase().includes('pad') ||
        inst.toLowerCase().includes('string')
      );
      if (harmonicInstruments.length > 0) {
        // Add multiple instruments for variety
        const selectedHarmonic = harmonicInstruments[Math.floor(Math.abs(sensorData.x) * 10) % harmonicInstruments.length];
        instruments.push(selectedHarmonic);
      }
    }

    // Y-axis movement - rhythmic instruments (ULTRA-SENSITIVE)
    if (Math.abs(sensorData.y) > movementThreshold) {
      const rhythmicInstruments = availableInstruments.filter(inst => 
        inst.toLowerCase().includes('drum') || 
        inst.toLowerCase().includes('percussion') ||
        inst.toLowerCase().includes('beat') ||
        inst.toLowerCase().includes('break')
      );
      if (rhythmicInstruments.length > 0) {
        const selectedRhythmic = rhythmicInstruments[Math.floor(Math.abs(sensorData.y) * 10) % rhythmicInstruments.length];
        instruments.push(selectedRhythmic);
      }
    }

    // Z-axis movement - bass and texture instruments (ULTRA-SENSITIVE)
    if (Math.abs(sensorData.z) > movementThreshold) {
      const textureInstruments = availableInstruments.filter(inst => 
        inst.toLowerCase().includes('bass') || 
        inst.toLowerCase().includes('texture') ||
        inst.toLowerCase().includes('ambient') ||
        inst.toLowerCase().includes('space')
      );
      if (textureInstruments.length > 0) {
        const selectedTexture = textureInstruments[Math.floor(sensorData.z * 10) % textureInstruments.length];
        instruments.push(selectedTexture);
      }
    }

    // Add random variety instrument based on energy
    if (energyLevel > 0.6 && Math.random() < 0.4) {
      const randomInstrument = availableInstruments[Math.floor(Math.random() * availableInstruments.length)];
      if (!instruments.includes(randomInstrument)) {
        instruments.push(randomInstrument);
      }
    }

    return [...new Set(instruments)]; // Remove duplicates
  }

  // Select PSYCHEDELIC moods with clean distortions
  selectPsychedelicMoods(intensity, availableMoods, sensorData) {
    const selectedMoods = [];
    
    // Base mood selection
    if (intensity < 0.3) {
      selectedMoods.push(...availableMoods.filter(mood => 
        mood.toLowerCase().includes('ambient') ||
        mood.toLowerCase().includes('dreamy') ||
        mood.toLowerCase().includes('meditative') ||
        mood.toLowerCase().includes('clean')
      ));
    } else if (intensity < 0.7) {
      selectedMoods.push(...availableMoods.filter(mood => 
        mood.toLowerCase().includes('psychedelic') ||
        mood.toLowerCase().includes('ethereal') ||
        mood.toLowerCase().includes('flowing') ||
        mood.toLowerCase().includes('warm')
      ));
    } else {
      selectedMoods.push(...availableMoods.filter(mood => 
        mood.toLowerCase().includes('cosmic') ||
        mood.toLowerCase().includes('transcendent') ||
        mood.toLowerCase().includes('organic') ||
        mood.toLowerCase().includes('wild')
      ));
    }

    // Add sensor-specific psychedelic elements
    if (sensorData.source === 'camera') {
      selectedMoods.push('Visual morphing', 'Kaleidoscopic');
    } else if (sensorData.source === 'keyboard') {
      selectedMoods.push('Rhythmic transformation', 'Digital organic');
    }

    return selectedMoods.slice(0, 3); // Limit to 3 for readability
  }

  // Get temporal variation elements for constant change
  getTemporalVariation() {
    const time = Date.now();
    const variations = [
      'Evolving textures',
      'Morphing harmonies', 
      'Shifting rhythms',
      'Breathing dynamics',
      'Liquid transitions',
      'Organic development',
      'Spatial movement',
      'Timbral shifts'
    ];
    
    // Cycle through variations based on time
    const index = Math.floor(time / 4000) % variations.length;
    return variations[index];
  }

  // Generate VARIETY-OPTIMIZED Lyria configuration
  generateVarietyOptimizedConfig(sensorData, normalizedMagnitude) {
    const energyLevel = Math.max(normalizedMagnitude * 1.2, 0.2);
    const currentGenre = this.getCurrentGenre(energyLevel);
    const genreData = this.raveGenres[currentGenre];
    
    // DYNAMIC BPM with micro-variations
    const bpmVariation = Math.sin(Date.now() / 2000) * 3; // ±3 BPM variation
    const bpmRange = genreData.bpmRange[1] - genreData.bpmRange[0];
    const bpm = Math.floor(
      genreData.bpmRange[0] + (energyLevel * bpmRange) + bpmVariation
    );

    // ENHANCED DENSITY with dynamic variation
    const densityVariation = Math.sin(sensorData.x * 5 + Date.now() / 1500) * 0.1;
    const baseDensity = genreData.densityRange[0];
    const density = Math.min(
      baseDensity + (energyLevel * (genreData.densityRange[1] - baseDensity)) + densityVariation,
      1.0
    );

    // DYNAMIC BRIGHTNESS with sensor influence
    const brightnessVariation = Math.sin(sensorData.y * 3 + Date.now() / 1800) * 0.1;
    const baseBrightness = genreData.brightnessRange[0];
    const brightness = Math.min(
      baseBrightness + (energyLevel * (genreData.brightnessRange[1] - baseBrightness)) + brightnessVariation,
      1.0
    );

    // ULTRA-LOW GUIDANCE for maximum creativity and variety (CRITICAL OPTIMIZATION)
    const movementVariance = this.calculateMovementVariance(sensorData);
    const guidanceVariation = Math.sin(Date.now() / 2500) * 0.3; // Dynamic guidance variation
    const baseGuidance = 0.5 + (movementVariance * 0.5); // Base range 0.5-1.0
    const guidance = Math.max(0.5, Math.min(baseGuidance + guidanceVariation, 2.5)); // Ultra-low for creativity

    // ULTRA-HIGH TEMPERATURE for maximum variation and reduced repetition (CRITICAL)
    const temperatureVariation = Math.sin(Date.now() / 3000) * 0.4; // Increased variation
    const sensorInfluence = Math.abs(sensorData.x + sensorData.y + sensorData.z) * 0.2;
    const baseTemperature = 1.8 + (energyLevel * 0.7); // Base high temperature
    const temperature = baseTemperature + temperatureVariation + sensorInfluence; // 1.8-3.5+ range

    // DYNAMIC top_k for variety control with chaos injection
    const chaosVariation = Math.sin(Date.now() / 1800) * 10; // ±10 variation
    const topK = Math.floor(25 + (energyLevel * 15) + chaosVariation); // 15-50 range

    // EXPERIMENTAL PARAMETERS for maximum variety
    const varietyBoost = this.calculateVarietyBoost(sensorData);
    
    return {
      bpm,
      density: parseFloat(density.toFixed(3)),
      brightness: parseFloat(brightness.toFixed(3)),
      temperature: parseFloat(Math.max(1.5, Math.min(3.8, temperature)).toFixed(3)), // Extended range for chaos
      guidance: parseFloat(Math.max(0.5, Math.min(2.5, guidance)).toFixed(3)), // Ultra-low guidance
      topK: Math.max(15, Math.min(60, topK)), // Extended range
      muteBass: false,
      muteDrums: false,
      onlyBassAndDrums: false,
      // EXPERIMENTAL: Add variety metadata for orchestrator
      varietyLevel: varietyBoost,
      chaosMode: varietyBoost > 0.7,
      psychedelicIntensity: energyLevel * varietyBoost
    };
  }

  // Calculate variety boost for chaos injection
  calculateVarietyBoost(sensorData) {
    const movementChaos = Math.abs(sensorData.x * sensorData.y * sensorData.z) * 2;
    const timeVariation = Math.sin(Date.now() / 4000) * 0.4;
    const genreVariety = this.genreHistory.length > 0 ? 
      new Set(this.genreHistory.slice(-5)).size / 5 : 0.5; // Increased history tracking
    
    return Math.min(movementChaos + timeVariation + genreVariety, 1.0);
  }

  // Generate COMPLEX weighted prompts for maximum variety
  generateComplexWeightedPrompts(currentStyle, intensity, sensorData) {
    if (!this.lastInterpretation) {
      return [{ text: currentStyle, weight: 1.0 }];
    }

    const lastStyle = this.lastInterpretation.stylePrompt;
    
    // ULTRA-SENSITIVE transition detection with chaos triggers
    if (this.shouldCreateEnhancedVarietyTransition(currentStyle, lastStyle, intensity, sensorData)) {
      // Create ULTRA-COMPLEX multi-prompt transitions for maximum variety
      const transitionWeight = Math.min(intensity + 0.3, 0.9); // More aggressive transitions
      const varietyPrompts = [];
      
      // Add previous style with fade-out
      varietyPrompts.push({ 
        text: lastStyle, 
        weight: parseFloat((1 - transitionWeight).toFixed(2)) 
      });
      
      // Add current style with fade-in
      varietyPrompts.push({ 
        text: currentStyle, 
        weight: parseFloat(transitionWeight.toFixed(2)) 
      });
      
      // Add CHAOS INJECTION - multiple random genre elements for unpredictability
      if (Math.random() < 0.5) { // 50% chance for chaos injection
        const varietyGenres = Object.keys(this.raveGenres);
        const numChaos = intensity > 0.7 ? 2 : 1; // More chaos at high intensity
        
        for (let i = 0; i < numChaos; i++) {
          const randomGenre = varietyGenres[Math.floor(Math.random() * varietyGenres.length)];
          const chaosElement = this.raveGenres[randomGenre].base;
          const chaosWeight = 0.1 + Math.random() * 0.15; // 0.1-0.25 weight
          
          varietyPrompts.push({ 
            text: chaosElement + ' chaos injection', 
            weight: parseFloat(chaosWeight.toFixed(2))
          });
        }
      }
      
      return varietyPrompts;
    }

    return [{ text: currentStyle, weight: 1.0 }];
  }

  // ENHANCED ULTRA-SENSITIVE transition detection for maximum variety
  shouldCreateEnhancedVarietyTransition(currentStyle, lastStyle, intensity, sensorData) {
    if (!lastStyle || currentStyle === lastStyle) return false;
    
    // Multiple AGGRESSIVE trigger conditions for variety
    const intensityChange = Math.abs(intensity - (this.lastInterpretation?.magnitude || 0));
    const sensorSpike = Math.abs(sensorData.x) > 0.2 || Math.abs(sensorData.y) > 0.2 || Math.abs(sensorData.z) > 0.4;
    const timeChange = Date.now() - this.lastInterpretation.timestamp > 1500; // Force change every 1.5 seconds
    const microMovement = this.hasMicroMovement(sensorData);
    const varietyStarvation = this.detectVarietyStarvation();
    
    return intensityChange > this.transitionThreshold || sensorSpike || timeChange || microMovement || varietyStarvation;
  }

  // Detect micro-movements that should trigger variety
  hasMicroMovement(sensorData) {
    const totalMovement = Math.abs(sensorData.x) + Math.abs(sensorData.y) + Math.abs(sensorData.z);
    return totalMovement > 0.1 && totalMovement < 0.3; // Small but present movement
  }

  // Detect when variety has been lacking (same genre repeated)
  detectVarietyStarvation() {
    if (this.genreHistory.length < 4) return false;
    
    const recentGenres = this.genreHistory.slice(-4);
    const uniqueGenres = new Set(recentGenres);
    
    // If less than 3 unique genres in last 4, inject variety
    return uniqueGenres.size < 3;
  }

  // Calculate variety factor for dynamic adjustment
  calculateVarietyFactor(sensorData) {
    const movement = Math.sqrt(sensorData.x ** 2 + sensorData.y ** 2 + sensorData.z ** 2);
    const timeVariation = Math.sin(Date.now() / 5000) * 0.3;
    const genreVariety = this.genreHistory.length > 0 ? 
      new Set(this.genreHistory.slice(-4)).size / 4 : 0.5; // Genre diversity factor
    
    return Math.min(movement * 0.3 + timeVariation + genreVariety, 1.0);
  }

  // Detect variety transitions for smoother orchestration
  detectVarietyTransition(currentStyle) {
    if (!this.lastInterpretation) return false;
    
    // Enhanced transition detection
    const styleChanged = currentStyle !== this.lastInterpretation.stylePrompt;
    const varietyFactor = this.calculateVarietyFactor({ x: 0.1, y: 0.1, z: 0.1 });
    
    return styleChanged || varietyFactor > 0.7;
  }

  // Get current genre with enhanced variety selection
  getCurrentGenre(intensity) {
    const timeVariation = Math.sin(Date.now() / 3000) * 0.3;
    const adjustedIntensity = Math.max(intensity + timeVariation, 0.1);
    
    if (adjustedIntensity < 0.15) return 'ambient-dub';
    if (adjustedIntensity < 0.3) return 'melodic-house';
    if (adjustedIntensity < 0.45) return 'psychedelic-acid';
    if (adjustedIntensity < 0.6) return 'dreamy-techno';
    if (adjustedIntensity < 0.75) return 'breakbeat-fusion';
    if (adjustedIntensity < 0.85) return 'cosmic-trance';
    if (adjustedIntensity < 0.95) return 'liquid-bass';
    return 'forest-psytrance';
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

  // Categorize intensity for orchestrator decision making
  categorizeIntensity(magnitude) {
    if (magnitude < 0.2) return 'low';
    if (magnitude < 0.6) return 'medium';
    if (magnitude < 0.8) return 'high';
    return 'extreme';
  }

  // Default interpretation with ENHANCED VARIETY and psychedelic elements
  getVarietyDefaultInterpretation() {
    return {
      stylePrompt: 'Psychedelic Acid House, Crystalline Distortion, Prismatic Reverb, Dreamy Chaos, Ethereal Morphing',
      weightedPrompts: [{ text: 'Psychedelic Acid House, Clean Chaos Distortion, Reality Bending', weight: 1.0 }],
      lyriaConfig: {
        bpm: 130,
        density: 0.6,
        brightness: 0.8,
        temperature: 2.3,      // ULTRA-HIGH temperature for maximum variety
        guidance: 0.8,         // ULTRA-LOW guidance for maximum creativity
        topK: 35,
        muteBass: false,
        muteDrums: false,
        onlyBassAndDrums: false,
        varietyLevel: 0.8,
        chaosMode: true,
        psychedelicIntensity: 0.7
      },
      magnitude: 0.4,
      rawMagnitude: 1.0,
      timestamp: Date.now(),
      hasTransition: false,
      intensity: 'medium',
      movement: 'psychedelic',
      varietyFactor: 0.8
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

  // Select ENHANCED PSYCHEDELIC moods with maximum clean distortion
  selectEnhancedPsychedelicMoods(intensity, availableMoods, sensorData) {
    const selectedMoods = [];
    
    // ENHANCED mood selection with psychedelic emphasis
    if (intensity < 0.25) {
      selectedMoods.push(...availableMoods.filter(mood => 
        mood.toLowerCase().includes('ambient') ||
        mood.toLowerCase().includes('dreamy') ||
        mood.toLowerCase().includes('meditative') ||
        mood.toLowerCase().includes('clean')
      ));
      // Add ambient psychedelic elements
      selectedMoods.push('Gentle morphing', 'Soft crystalline textures');
    } else if (intensity < 0.65) {
      selectedMoods.push(...availableMoods.filter(mood => 
        mood.toLowerCase().includes('psychedelic') ||
        mood.toLowerCase().includes('ethereal') ||
        mood.toLowerCase().includes('flowing') ||
        mood.toLowerCase().includes('warm')
      ));
      // Add medium psychedelic elements
      selectedMoods.push('Prismatic shifts', 'Liquid harmonics', 'Crystal cascade effects');
    } else {
      selectedMoods.push(...availableMoods.filter(mood => 
        mood.toLowerCase().includes('cosmic') ||
        mood.toLowerCase().includes('transcendent') ||
        mood.toLowerCase().includes('organic') ||
        mood.toLowerCase().includes('wild')
      ));
      // Add intense psychedelic elements
      selectedMoods.push('Reality bending', 'Dimensional shifts', 'Fractal patterns', 'Chaos morphing');
    }

    // Add sensor-specific ENHANCED psychedelic elements
    if (sensorData.source === 'camera') {
      selectedMoods.push('Visual-audio synesthesia', 'Motion reactive textures');
    } else if (sensorData.source === 'keyboard') {
      selectedMoods.push('Keystroke harmonics', 'Digital-organic fusion');
    } else if (sensorData.source === 'mouse') {
      selectedMoods.push('Cursor trail echoes', 'Micro-movement amplification');
    }

    return [...new Set(selectedMoods)].slice(0, 4); // More moods, remove duplicates
  }

  // Get ENHANCED temporal variation elements for maximum chaos
  getEnhancedTemporalVariation(energyLevel) {
    const time = Date.now();
    const variations = [
      'Evolving crystalline textures',
      'Morphing harmonic spirals', 
      'Shifting rhythmic dimensions',
      'Breathing organic dynamics',
      'Liquid temporal transitions',
      'Fractal development patterns',
      'Spatial frequency movement',
      'Prismatic timbral shifts',
      'Chaos-to-order evolution',
      'Dimensional phase rotation',
      'Quantum state fluctuations',
      'Reality fabric distortions'
    ];
    
    // CHAOTIC variation selection based on energy and time
    let index;
    if (energyLevel > 0.8) {
      // High energy: More chaotic variations
      index = Math.floor((time / 2000) + energyLevel * 5) % variations.length;
    } else {
      // Lower energy: Standard cycling
      index = Math.floor(time / 3500) % variations.length;
    }
    
    return variations[index];
  }
}

// Export singleton instance
export const sensorInterpreter = new SensorInterpreter(); 