import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING } from '../theme';
import GlitchText from './ui/GlitchText';
import Button from './ui/Button';
import GlitchContainer from './ui/GlitchContainer';

const { width, height } = Dimensions.get('window');

interface VibestreamModalProps {
  visible: boolean;
  onClose: () => void;
}

type VibestreamMode = 'solo' | 'group';

const VibestreamModal: React.FC<VibestreamModalProps> = ({ visible, onClose }) => {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<VibestreamMode>('solo');
  const [storeToFilecoin, setStoreToFilecoin] = useState(false);
  const [distance, setDistance] = useState('100');
  const [ticketAmount, setTicketAmount] = useState('0');
  const [streamPrice, setStreamPrice] = useState('0');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(0);
      setStep(1);
      setMode('solo');
      setStoreToFilecoin(false);
      setDistance('100');
      setTicketAmount('0');
      setStreamPrice('0');
    }
  }, [visible]);

  const handleModeSelect = (selectedMode: VibestreamMode) => {
    setMode(selectedMode);
    if (selectedMode === 'solo') {
      // Stay on step 1 for solo mode
    } else {
      // Move to step 2 for group mode
      setStep(2);
    }
  };

  const handleLaunchVibestream = () => {
    console.log('Launching Vibestream with:', {
      mode,
      storeToFilecoin,
      ...(mode === 'group' && {
        distance: parseInt(distance),
        ticketAmount: parseFloat(ticketAmount),
        streamPrice: parseFloat(streamPrice),
      }),
    });
    onClose();
  };

  const isLaunchDisabled = () => {
    if (mode === 'group') {
      return !distance || distance === '0';
    }
    return false;
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <GlitchText text="SELECT MODE" style={styles.stepTitle} intensity="medium" />
      
      <View style={styles.modeContainer}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'solo' && styles.selectedMode]}
          onPress={() => handleModeSelect('solo')}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeText, mode === 'solo' && styles.selectedModeText]}>
            SOLO
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.modeButton, mode === 'group' && styles.selectedMode]}
          onPress={() => handleModeSelect('group')}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeText, mode === 'group' && styles.selectedModeText]}>
            GROUP
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'solo' && (
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setStoreToFilecoin(!storeToFilecoin)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, storeToFilecoin && styles.checkedBox]}>
              {storeToFilecoin && (
                <FontAwesome name="check" size={12} color={COLORS.background} />
              )}
            </View>
            <Text style={styles.checkboxText}>Store to Filecoin</Text>
          </TouchableOpacity>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, isLaunchDisabled() && styles.disabledButton]}
              onPress={handleLaunchVibestream}
              disabled={isLaunchDisabled()}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionButtonText, isLaunchDisabled() && styles.disabledText]}>
                LAUNCH VIBESTREAM
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.disabledButton]}
              disabled={true}
              activeOpacity={1}
            >
              <Text style={[styles.actionButtonText, styles.disabledText]}>
                SCHEDULE
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setStep(1)}
        activeOpacity={0.7}
      >
        <FontAwesome name="arrow-left" size={16} color={COLORS.primary} />
        <Text style={styles.backText}>BACK</Text>
      </TouchableOpacity>

      <GlitchText text="GROUP SETTINGS" style={styles.stepTitle} intensity="medium" />
      
      <View style={styles.settingsContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Distance</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={distance}
              onChangeText={setDistance}
              placeholder="100"
              placeholderTextColor={COLORS.muted}
              keyboardType="numeric"
            />
            <Text style={styles.inputUnit}>m</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Ticket Amount</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={ticketAmount}
              onChangeText={setTicketAmount}
              placeholder="0"
              placeholderTextColor={COLORS.muted}
              keyboardType="numeric"
            />
            <Text style={styles.inputUnit}>$NEAR</Text>
          </View>
          <TouchableOpacity
            style={styles.freeButton}
            onPress={() => setTicketAmount('0')}
            activeOpacity={0.7}
          >
            <Text style={styles.freeButtonText}>FREE</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Stream Price</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={streamPrice}
              onChangeText={setStreamPrice}
              placeholder="0"
              placeholderTextColor={COLORS.muted}
              keyboardType="numeric"
            />
            <Text style={styles.inputUnit}>$NEAR</Text>
          </View>
          <TouchableOpacity
            style={styles.freeButton}
            onPress={() => setStreamPrice('0')}
            activeOpacity={0.7}
          >
            <Text style={styles.freeButtonText}>FREE</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setStoreToFilecoin(!storeToFilecoin)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, storeToFilecoin && styles.checkedBox]}>
            {storeToFilecoin && (
              <FontAwesome name="check" size={10} color={COLORS.background} />
            )}
          </View>
          <Text style={styles.checkboxText}>Store to Filecoin</Text>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, isLaunchDisabled() && styles.disabledButton]}
            onPress={handleLaunchVibestream}
            disabled={isLaunchDisabled()}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionButtonText, isLaunchDisabled() && styles.disabledText]}>
              LAUNCH VIBESTREAM
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.disabledButton]}
            disabled={true}
            activeOpacity={1}
          >
            <Text style={[styles.actionButtonText, styles.disabledText]}>
              SCHEDULE
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.overlayTouch} onPress={onClose} activeOpacity={1}>
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [height, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <GlitchContainer style={styles.modalContent} intensity="medium" animated>
                <LinearGradient
                  colors={[COLORS.background, COLORS.backgroundSecondary]}
                  style={styles.gradientBackground}
                >
                  <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                    <FontAwesome name="times" size={20} color={COLORS.primary} />
                  </TouchableOpacity>

                  <View style={styles.header}>
                    <GlitchText text="VIBESTREAM" style={styles.modalTitle} intensity="high" />
                    <Text style={styles.modalSubtitle}>Configure your vibe session</Text>
                  </View>

                  {step === 1 ? renderStep1() : renderStep2()}
                </LinearGradient>
              </GlitchContainer>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouch: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.85,
    maxWidth: 350,
    maxHeight: height * 0.7,
  },
  modalContent: {
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  gradientBackground: {
    padding: SPACING.lg,
    minHeight: 300,
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.medium,
    right: SPACING.medium,
    zIndex: 10,
    padding: SPACING.small,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.large,
    paddingTop: SPACING.medium,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '900',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    letterSpacing: 2,
  },
  modeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  modeButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  selectedMode: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(0, 255, 65, 0.1)',
  },
  modeText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  selectedModeText: {
    color: COLORS.primary,
  },
  optionsContainer: {
    marginTop: SPACING.medium,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginRight: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  actionButtons: {
    gap: SPACING.md,
  },
  actionButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  disabledButton: {
    opacity: 0.3,
    borderColor: COLORS.textSecondary,
  },
  disabledText: {
    color: COLORS.textSecondary,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  backText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: SPACING.sm,
    letterSpacing: 0.5,
  },
  settingsContainer: {
    gap: SPACING.md,
  },
  inputGroup: {
    position: 'relative',
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  textInput: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '500',
    paddingVertical: SPACING.sm,
  },
  inputUnit: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginLeft: SPACING.sm,
    letterSpacing: 0.5,
  },
  freeButton: {
    position: 'absolute',
    right: 0,
    top: 24,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    backgroundColor: COLORS.primary,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  freeButtonText: {
    fontSize: 9,
    color: COLORS.background,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default VibestreamModal;