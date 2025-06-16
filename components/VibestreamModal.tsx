import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { COLORS } from '../theme';
import { GlitchText, GlitchContainer, AcidButton } from './ui';
import { useWallet } from '../context/HotWalletConnector';

interface VibestreamModalProps {
  visible: boolean;
  onClose: () => void;
}

type VibeMode = 'Solo' | 'Group';
type VibeSchedule = 'Launch' | 'Schedule';
type Step = 'mode' | 'group-config' | 'timing';

const VibestreamModal: React.FC<VibestreamModalProps> = ({ visible, onClose }) => {
  const { account, signTransaction } = useWallet();
  
  const [currentStep, setCurrentStep] = useState<Step>('mode');
  const [mode, setMode] = useState<VibeMode>('Solo');
  const [schedule, setSchedule] = useState<VibeSchedule>('Launch');
  const [storeToFilecoin, setStoreToFilecoin] = useState<boolean>(true);
  const [distance, setDistance] = useState<string>('50');
  const [seats, setSeats] = useState<string>('10');
  const [entryFee, setEntryFee] = useState<string>('0');
  const [payPerStream, setPayPerStream] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleNext = () => {
    if (currentStep === 'mode' && mode === 'Group') {
      setCurrentStep('group-config');
    } else if (currentStep === 'group-config') {
      setCurrentStep('timing');
    }
  };

  const handleBack = () => {
    if (currentStep === 'group-config') {
      setCurrentStep('mode');
    } else if (currentStep === 'timing') {
      setCurrentStep(mode === 'Group' ? 'group-config' : 'mode');
    }
  };

  const handleLaunch = async () => {
    setError(null);
    
    if (schedule === 'Schedule') {
      setError('SCHEDULED VIBES COMING SOON');
      return;
    }
    
    try {
      setLoading(true);
      
      const config = {
        mode: mode,
        storeToFilecoin: mode === 'Solo' ? storeToFilecoin : true,
        distance: mode === 'Group' ? parseFloat(distance) : undefined,
        seats: mode === 'Group' ? parseInt(seats, 10) : undefined,
        entryFee: mode === 'Group' ? parseFloat(entryFee) : undefined,
        payPerStream: mode === 'Group' ? payPerStream : undefined,
        accountId: account?.accountId
      };
      
      console.log('Launching Vibestream with config:', config);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (mode === 'Group' && parseFloat(entryFee) > 0) {
        const transaction = {
          receiverId: 'vibesflow.testnet',
          actions: [{
            type: 'FunctionCall',
            params: {
              methodName: 'create_vibe_session',
              args: {
                mode: mode.toLowerCase(),
                entry_fee: entryFee,
                max_participants: seats === '∞' ? null : parseInt(seats, 10),
                distance_meters: parseFloat(distance),
                pay_per_stream: payPerStream
              },
              gas: '30000000000000',
              deposit: entryFee + '000000000000000000000000'
            }
          }]
        };
        
        await signTransaction(transaction);
      }
      
      setLoading(false);
      onClose();
      
    } catch (error) {
      console.error('Error launching Vibestream:', error);
      setLoading(false);
      setError('FAILED TO LAUNCH VIBESTREAM. TRY AGAIN.');
    }
  };
  
  const renderModeStep = () => (
    <View style={styles.stepContainer}>
      <GlitchText text="MODE" style={styles.stepTitle} intensity="low" />
      
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'Solo' && styles.activeModeButton]}
          onPress={() => setMode('Solo')}
        >
          <Text style={[styles.modeButtonText, mode === 'Solo' && styles.activeModeButtonText]}>
            SOLO
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.modeButton, mode === 'Group' && styles.activeModeButton]}
          onPress={() => setMode('Group')}
        >
          <Text style={[styles.modeButtonText, mode === 'Group' && styles.activeModeButtonText]}>
            GROUP
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'Solo' && (
        <View style={styles.checkboxContainer}>
          <TouchableOpacity 
            style={styles.checkbox}
            onPress={() => setStoreToFilecoin(!storeToFilecoin)}
          >
            <View style={[styles.checkboxBox, storeToFilecoin && styles.checkboxChecked]}>
              {storeToFilecoin && <FontAwesome name="check" size={12} color={COLORS.background} />}
            </View>
            <Text style={styles.checkboxText}>STORE TO FILECOIN</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.timingButtons}>
        <TouchableOpacity
          style={[styles.timingButton, schedule === 'Launch' && styles.activeTimingButton]}
          onPress={() => setSchedule('Launch')}
        >
          <Text style={[styles.timingButtonText, schedule === 'Launch' && styles.activeTimingButtonText]}>
            LAUNCH VIBESTREAM
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.timingButton, styles.disabledButton]}
          disabled={true}
        >
          <Text style={[styles.timingButtonText, styles.disabledButtonText]}>
            SCHEDULE
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  const renderGroupConfigStep = () => (
    <View style={styles.stepContainer}>
      <GlitchText text="GROUP CONFIGURATION" style={styles.stepTitle} intensity="low" />
      
      <View style={styles.configOption}>
        <Text style={styles.configLabel}>DISTANCE (METERS)</Text>
        <TextInput
          style={styles.configInput}
          value={distance}
          onChangeText={setDistance}
          keyboardType="numeric"
          placeholder="50"
          placeholderTextColor={COLORS.textTertiary}
        />
      </View>
      
      <View style={styles.configOption}>
        <Text style={styles.configLabel}>SEATS</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.configInput, styles.flexInput]}
            value={seats}
            onChangeText={setSeats}
            keyboardType="numeric"
            placeholder="10"
            placeholderTextColor={COLORS.textTertiary}
          />
          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => setSeats('∞')}
          >
            <Text style={styles.quickButtonText}>NO LIMIT</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.configOption}>
        <Text style={styles.configLabel}>ENTRY FEE (NEAR)</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.configInput, styles.flexInput]}
            value={entryFee}
            onChangeText={setEntryFee}
            keyboardType="numeric"
            placeholder="0.1"
            placeholderTextColor={COLORS.textTertiary}
          />
          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => setEntryFee('0')}
          >
            <Text style={styles.quickButtonText}>FREE</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity 
          style={styles.checkbox}
          onPress={() => setPayPerStream(!payPerStream)}
        >
          <View style={[styles.checkboxBox, payPerStream && styles.checkboxChecked]}>
            {payPerStream && <FontAwesome name="check" size={12} color={COLORS.background} />}
          </View>
          <Text style={styles.checkboxText}>PAY-PER-STREAM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'mode':
        return renderModeStep();
      case 'group-config':
        return renderGroupConfigStep();
      default:
        return renderModeStep();
    }
  };
  
  const renderErrorMessage = () => {
    if (!error) return null;
    
    return (
      <View style={styles.errorContainer}>
        <FontAwesome name="exclamation-triangle" size={16} color={COLORS.accent} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  };
  
  const canProceed = () => {
    if (currentStep === 'mode') {
      return mode === 'Solo' || mode === 'Group';
    }
    return true;
  };

  const handleOutsidePress = () => {
    if (loading) return;
    onClose();
  };

  const handleModalClose = () => {
    setCurrentStep('mode');
    setMode('Solo');
    setStoreToFilecoin(true);
    setPayPerStream(false);
    setError(null);
    onClose();
  };
  
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleModalClose}
    >
      <Pressable style={styles.modalOverlay} onPress={handleOutsidePress}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <GlitchContainer 
            style={styles.modalContent}
            intensity="low"
            borderColor={COLORS.primary}
            backgroundColor={COLORS.background}
          >
            <LinearGradient
              colors={[COLORS.backgroundLight, COLORS.background]}
              style={styles.modalBackground}
            />
            
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={handleModalClose}
                disabled={loading}
              >
                <FontAwesome name="times" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {renderErrorMessage()}
              {renderCurrentStep()}
            </ScrollView>
            
            <View style={styles.footer}>
              {currentStep !== 'mode' && (
                <AcidButton
                  text="BACK"
                  onPress={handleBack}
                  type="secondary"
                  size="medium"
                  style={styles.backButton}
                  disabled={loading}
                />
              )}
              
              {currentStep === 'mode' && mode === 'Group' ? (
                <AcidButton
                  text="NEXT"
                  onPress={handleNext}
                  type="primary"
                  size="medium"
                  style={styles.nextButton}
                  disabled={!canProceed()}
                />
              ) : (
                <AcidButton
                  text={loading ? "LAUNCHING..." : "LAUNCH VIBESTREAM"}
                  onPress={handleLaunch}
                  type="primary"
                  size="medium"
                  disabled={loading || !canProceed() || schedule === 'Schedule'}
                  style={styles.launchButton}
                  showLoadingIndicator={loading}
                  pulsate={!loading && canProceed() && schedule === 'Launch'}
                />
              )}
            </View>
          </GlitchContainer>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
  },
  modalContent: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 15,
    paddingBottom: 0,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 10,
    flexGrow: 1,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 25,
    letterSpacing: 2,
    textAlign: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 25,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: COLORS.textTertiary,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeModeButton: {
    backgroundColor: `${COLORS.primary}20`,
    borderColor: COLORS.primary,
  },
  modeButtonText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
  },
  activeModeButtonText: {
    color: COLORS.primary,
  },
  checkboxContainer: {
    marginBottom: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: COLORS.textTertiary,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1,
  },
  timingButtons: {
    gap: 12,
  },
  timingButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: COLORS.textTertiary,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTimingButton: {
    backgroundColor: `${COLORS.primary}20`,
    borderColor: COLORS.primary,
  },
  disabledButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderColor: COLORS.textTertiary,
    opacity: 0.5,
  },
  timingButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  activeTimingButtonText: {
    color: COLORS.primary,
  },
  disabledButtonText: {
    color: COLORS.textTertiary,
  },
  configOption: {
    marginBottom: 20,
  },
  configLabel: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  configInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: COLORS.textTertiary,
    borderRadius: 6,
    padding: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
    letterSpacing: 1,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexInput: {
    flex: 1,
  },
  quickButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: `${COLORS.accent}20`,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 6,
    justifyContent: 'center',
  },
  quickButtonText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.accent}20`,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 6,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 15,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: `${COLORS.primary}30`,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  launchButton: {
    flex: 1,
  },
});

export default VibestreamModal;