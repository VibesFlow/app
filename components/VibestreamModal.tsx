import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';
import { COLORS } from '../theme';
import GlitchText from './ui/GlitchText';

const { width } = Dimensions.get('window');

interface VibestreamModalProps {
  visible: boolean;
  onClose: () => void;
  onLaunchVibePlayer: () => void;
}

type VibestreamMode = 'solo' | 'group';

const VibestreamModal: React.FC<VibestreamModalProps> = ({ visible, onClose }) => {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<VibestreamMode>('solo');
  const [storeToFilecoin, setStoreToFilecoin] = useState(true);
  const [distance, setDistance] = useState('100');
  const [ticketAmount, setTicketAmount] = useState('0');
  const [streamPrice, setStreamPrice] = useState('0');
  const [freeTickets, setFreeTickets] = useState(false);
  const [ticketPrice, setTicketPrice] = useState('0');
  const [payPerStream, setPayPerStream] = useState(false);

  const resetModal = () => {
    setStep(1);
    setMode('solo');
    setStoreToFilecoin(true);
    setDistance('100');
    setTicketAmount('0');
    setTicketPrice('0');
    setStreamPrice('0');
    setFreeTickets(false);
    setPayPerStream(false);
  };

  useEffect(() => {
    if (!visible) {
      resetModal();
    }
  }, [visible]);

  const handleModeSelect = (selectedMode: VibestreamMode) => {
    setMode(selectedMode);
    if (selectedMode === 'solo') {
      setStep(2);
    } else {
      setStep(2);
    }
  };

  const handleLaunchVibestream = () => {
    console.log('Launching Vibestream with:', {
      mode,
      storeToFilecoin: mode === 'solo' ? storeToFilecoin : undefined,
      distance: mode === 'group' ? distance : undefined,
      ticketAmount: mode === 'group' ? ticketAmount : undefined,
      streamPrice: mode === 'group' ? streamPrice : undefined,
    });
    onClose();
  };

  const isLaunchDisabled = () => {
    if (mode === 'group') {
      return !distance || distance === '0' || !ticketAmount || !streamPrice;
    }
    return false;
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>SELECT MODE</Text>
      
      <View style={styles.modeContainer}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'solo' && styles.selectedMode]}
          onPress={() => handleModeSelect('solo')}
          activeOpacity={0.7}
        >
          <Text style={styles.modeText}>SOLO</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.modeButton, mode === 'group' && styles.selectedMode]}
          onPress={() => handleModeSelect('group')}
          activeOpacity={0.7}
        >
          <Text style={styles.modeText}>GROUP</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setStep(1)}
        activeOpacity={0.7}
      >
        <FontAwesome name="chevron-left" size={12} color={COLORS.primary} />
        <Text style={styles.backText}>BACK</Text>
      </TouchableOpacity>

      <Text style={styles.stepTitle}>{mode === 'solo' ? 'SOLO SETTINGS' : 'GROUP SETTINGS'}</Text>
      
      {mode === 'group' && (
        <View style={styles.settingsContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DISTANCE</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={distance}
                onChangeText={setDistance}
                placeholder="100"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="numeric"
              />
              <Text style={styles.inputUnit}>MT</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>TICKETS</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={ticketAmount}
                onChangeText={setTicketAmount}
                placeholder="0"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="numeric"
              />
              <Text style={styles.inputUnit}>AMT</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>TICKET PRICE?</Text>
            <View style={styles.payPerStreamContainer}>
              <TouchableOpacity
                style={styles.ynCheckboxContainer}
                onPress={() => setFreeTickets(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, freeTickets && styles.checkedBox]}>
                  {freeTickets && (
                    <FontAwesome name="check" size={8} color={COLORS.background} />
                  )}
                </View>
                <Text style={styles.ynCheckboxText}>N</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.ynCheckboxContainer}
                onPress={() => setFreeTickets(false)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, !freeTickets && styles.checkedBox]}>
                  {!freeTickets && (
                    <FontAwesome name="check" size={8} color={COLORS.background} />
                  )}
                </View>
                <Text style={styles.ynCheckboxText}>Y</Text>
              </TouchableOpacity>
              
              <View style={[styles.priceInputContainer, freeTickets && styles.disabledInput]}>
                <TextInput
                  style={[styles.textInput, freeTickets && styles.disabledTextInput]}
                  value={ticketPrice}
                  onChangeText={setTicketPrice}
                  placeholder="0"
                  placeholderTextColor={freeTickets ? COLORS.textTertiary : COLORS.textSecondary}
                  keyboardType="decimal-pad"
                  editable={!freeTickets}
                />
                <Text style={[styles.inputUnit, freeTickets && styles.disabledInputUnit]}>$NEAR</Text>
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PAY-PER-STREAM?</Text>
            <View style={styles.payPerStreamContainer}>
              <TouchableOpacity
                style={styles.ynCheckboxContainer}
                onPress={() => setPayPerStream(false)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, !payPerStream && styles.checkedBox]}>
                  {!payPerStream && (
                    <FontAwesome name="check" size={8} color={COLORS.background} />
                  )}
                </View>
                <Text style={styles.ynCheckboxText}>N</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.ynCheckboxContainer}
                onPress={() => setPayPerStream(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, payPerStream && styles.checkedBox]}>
                  {payPerStream && (
                    <FontAwesome name="check" size={8} color={COLORS.background} />
                  )}
                </View>
                <Text style={styles.ynCheckboxText}>Y</Text>
              </TouchableOpacity>
              
              <View style={[styles.priceInputContainer, !payPerStream && styles.disabledInput]}>
                <TextInput
                  style={[styles.textInput, !payPerStream && styles.disabledTextInput]}
                  value={streamPrice}
                  onChangeText={setStreamPrice}
                  placeholder="0"
                  placeholderTextColor={!payPerStream ? COLORS.textTertiary : COLORS.textSecondary}
                  keyboardType="decimal-pad"
                  editable={payPerStream}
                />
                <Text style={[styles.inputUnit, !payPerStream && styles.disabledInputUnit]}>$NEAR</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => setStoreToFilecoin(!storeToFilecoin)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, storeToFilecoin && styles.checkedBox]}>
          {storeToFilecoin && (
            <FontAwesome name="check" size={8} color={COLORS.background} />
          )}
        </View>
        <Text style={styles.checkboxText}>Store to Filecoin</Text>
      </TouchableOpacity>

      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={[styles.actionButton, isLaunchDisabled() && styles.disabledButton]}
          onPress={handleLaunchVibestream}
          disabled={isLaunchDisabled()}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionButtonText, isLaunchDisabled() && styles.disabledText]}>
            LAUNCH
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
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayTouch} onPress={onClose} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <LinearGradient
                colors={[COLORS.background, '#0a0a0a']}
                style={styles.gradientBackground}
              >
                <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                  <FontAwesome name="times" size={16} color={COLORS.primary} />
                </TouchableOpacity>

                <View style={styles.header}>
                  <GlitchText text="VIBESTREAM" style={styles.modalTitle} intensity="medium" />
                </View>

                {step === 1 ? renderStep1() : renderStep2()}
              </LinearGradient>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouch: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.85,
    maxWidth: 320,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradientBackground: {
    padding: 24,
    minHeight: 250,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
    textAlign: 'center',
    letterSpacing: 3,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 2,
  },
  modeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  selectedMode: {
    backgroundColor: 'rgba(255, 0, 160, 0.15)',
    borderColor: COLORS.secondary,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: COLORS.primary,
  },
  checkboxText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  disabledButton: {
    opacity: 0.4,
  },
  disabledText: {
    color: COLORS.textSecondary,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: 1,
  },
  settingsContainer: {
    gap: 16,
  },
  inputGroup: {
    position: 'relative',
  },
  inputLabel: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  textInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '500',
    paddingVertical: 4,
  },
  inputUnit: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  freeCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 60,
  },
  freeCheckboxText: {
    fontSize: 10,
    color: COLORS.secondary,
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 1,
  },
  payPerStreamContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  ynCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ynCheckboxText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  priceInputContainer: {
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  disabledInput: {
    opacity: 0.4,
    borderColor: COLORS.textSecondary,
  },
  disabledTextInput: {
    color: COLORS.textSecondary,
  },
  disabledInputUnit: {
    color: COLORS.textSecondary,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  freeButton: {
    position: 'absolute',
    right: 0,
    top: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: COLORS.primary,
  },
  freeButtonText: {
    fontSize: 8,
    color: COLORS.background,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default VibestreamModal;