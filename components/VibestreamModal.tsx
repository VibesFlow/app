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
            <Button
              text="LAUNCH VIBESTREAM"
              onPress={handleLaunchVibestream}
              type="primary"
              size="large"
              disabled={isLaunchDisabled()}
            />
            <Button
              text="SCHEDULE"
              onPress={() => {}}
              type="secondary"
              size="large"
              disabled={true}
              style={styles.disabledButton}
            />
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
              <FontAwesome name="check" size={12} color={COLORS.background} />
            )}
          </View>
          <Text style={styles.checkboxText}>Store to Filecoin</Text>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <Button
            text="LAUNCH VIBESTREAM"
            onPress={handleLaunchVibestream}
            type="primary"
            size="large"
            disabled={isLaunchDisabled()}
          />
          <Button
            text="SCHEDULE"
            onPress={() => {}}
            type="secondary"
            size="large"
            disabled={true}
            style={styles.disabledButton}
          />
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
    width: width * 0.9,
    maxWidth: 400,
    maxHeight: height * 0.8,
  },
  modalContent: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradientBackground: {
    padding: SPACING.large,
    minHeight: 400,
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
    fontSize: FONT_SIZES.large,
    fontWeight: '900',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.small,
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: FONT_SIZES.medium,
    fontWeight: '700',
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: SPACING.large,
    letterSpacing: 2,
  },
  modeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.large,
    gap: SPACING.medium,
  },
  modeButton: {
    flex: 1,
    paddingVertical: SPACING.medium,
    paddingHorizontal: SPACING.large,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  selectedMode: {
    borderColor: COLORS.secondary,
    backgroundColor: 'rgba(255, 0, 160, 0.1)',
  },
  modeText: {
    fontSize: FONT_SIZES.medium,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  selectedModeText: {
    color: COLORS.secondary,
  },
  optionsContainer: {
    marginTop: SPACING.medium,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.large,
    paddingVertical: SPACING.small,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginRight: SPACING.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  checkboxText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.text,
    fontWeight: '600',
    letterSpacing: 1,
  },
  actionButtons: {
    gap: SPACING.medium,
  },
  disabledButton: {
    opacity: 0.5,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.large,
    paddingVertical: SPACING.small,
  },
  backText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: SPACING.small,
    letterSpacing: 1,
  },
  settingsContainer: {
    gap: SPACING.large,
  },
  inputGroup: {
    position: 'relative',
  },
  inputLabel: {
    fontSize: FONT_SIZES.small,
    color: COLORS.secondary,
    fontWeight: '600',
    marginBottom: SPACING.small,
    letterSpacing: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.small,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  textInput: {
    flex: 1,
    fontSize: FONT_SIZES.medium,
    color: COLORS.text,
    fontWeight: '600',
    paddingVertical: SPACING.small,
  },
  inputUnit: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginLeft: SPACING.small,
    letterSpacing: 1,
  },
  freeButton: {
    position: 'absolute',
    right: 0,
    top: 24,
    paddingHorizontal: SPACING.small,
    paddingVertical: 2,
    backgroundColor: COLORS.accent,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  freeButtonText: {
    fontSize: 10,
    color: COLORS.background,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

export default VibestreamModal;