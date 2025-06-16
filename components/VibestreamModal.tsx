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
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { COLORS, BRANDING } from '../theme';
import { GlitchText, GlitchContainer, AcidButton } from './ui';
import { useWallet } from '../context/HotWalletConnector';

interface VibestreamModalProps {
  visible: boolean;
  onClose: () => void;
}

type VibeMode = 'Solo' | 'Group';
type VibeSchedule = 'Now' | 'Schedule';
type SavePreference = 'Yes' | 'No';

const VibestreamModal: React.FC<VibestreamModalProps> = ({ visible, onClose }) => {
  const { account, signTransaction } = useWallet();
  
  const [mode, setMode] = useState<VibeMode>('Solo');
  const [schedule, setSchedule] = useState<VibeSchedule>('Now');
  const [save, setSave] = useState<SavePreference>('Yes');
  const [distance, setDistance] = useState<string>('50');
  const [seats, setSeats] = useState<string>('10');
  const [entryFee, setEntryFee] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleStart = async () => {
    setError(null);
    
    if (schedule === 'Schedule') {
      setError('SCHEDULED VIBES COMING SOON');
      return;
    }
    
    try {
      setLoading(true);
      
      const config = {
        mode: mode,
        saveHistory: save === 'Yes',
        distance: mode === 'Group' ? parseFloat(distance) : undefined,
        seats: mode === 'Group' ? parseInt(seats, 10) : undefined,
        entryFee: mode === 'Group' ? parseFloat(entryFee) : undefined,
        accountId: account?.accountId
      };
      
      console.log('Starting Vibestream with config:', config);
      
      // Simulate vibe session start on NEAR testnet
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (mode === 'Group' && parseFloat(entryFee) > 0) {
        // For paid group sessions, execute NEAR transaction
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
                distance_meters: parseFloat(distance)
              },
              gas: '30000000000000',
              deposit: entryFee + '000000000000000000000000' // Convert to yoctoNEAR
            }
          }]
        };
        
        await signTransaction(transaction);
      }
      
      setLoading(false);
      onClose(); // Close modal after successful start
      
    } catch (error) {
      console.error('Error starting Vibestream:', error);
      setLoading(false);
      setError('FAILED TO START VIBESTREAM. TRY AGAIN.');
    }
  };
  
  const renderModeSelection = () => (
    <View style={styles.optionContainer}>
      <GlitchText text="MODE" style={styles.optionTitle} intensity="low" />
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.optionButton, mode === 'Solo' && styles.activeOptionButton]}
          onPress={() => setMode('Solo')}
        >
          <Text style={[styles.optionButtonText, mode === 'Solo' && styles.activeOptionButtonText]}>
            SOLO
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.optionButton, mode === 'Group' && styles.activeOptionButton]}
          onPress={() => setMode('Group')}
        >
          <Text style={[styles.optionButtonText, mode === 'Group' && styles.activeOptionButtonText]}>
            GROUP
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  const renderGroupOptions = () => {
    if (mode !== 'Group') return null;
    
    return (
      <>
        <View style={styles.optionContainer}>
          <GlitchText text="DISTANCE (METERS)" style={styles.optionTitle} intensity="low" />
          <TextInput
            style={styles.textInput}
            value={distance}
            onChangeText={setDistance}
            keyboardType="numeric"
            placeholder="UP TO 50 METERS"
            placeholderTextColor={COLORS.textTertiary}
          />
        </View>
        
        <View style={styles.optionContainer}>
          <GlitchText text="SEATS" style={styles.optionTitle} intensity="low" />
          <View style={styles.entryRow}>
            <TextInput
              style={[styles.textInput, styles.entryInput]}
              value={seats}
              onChangeText={setSeats}
              keyboardType="numeric"
              placeholder="MAX PARTICIPANTS"
              placeholderTextColor={COLORS.textTertiary}
            />
            
            <TouchableOpacity
              style={styles.noCap}
              onPress={() => setSeats('∞')}
            >
              <Text style={styles.noCapText}>NO LIMIT</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.optionContainer}>
          <View style={styles.optionTitleRow}>
            <GlitchText text="ENTRY FEE" style={styles.optionTitle} intensity="low" />
            <Text style={styles.optionSubtitle}>(NEAR)</Text>
          </View>
          <View style={styles.entryRow}>
            <TextInput
              style={[styles.textInput, styles.entryInput]}
              value={entryFee}
              onChangeText={setEntryFee}
              keyboardType="numeric"
              placeholder="0.1"
              placeholderTextColor={COLORS.textTertiary}
            />
            
            <TouchableOpacity
              style={styles.noCap}
              onPress={() => setEntryFee('0')}
            >
              <Text style={styles.noCapText}>FREE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  };
  
  const renderScheduleOptions = () => (
    <View style={styles.optionContainer}>
      <GlitchText text="TIMING" style={styles.optionTitle} intensity="low" />
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.optionButton, schedule === 'Now' && styles.activeOptionButton]}
          onPress={() => setSchedule('Now')}
        >
          <Text style={[styles.optionButtonText, schedule === 'Now' && styles.activeOptionButtonText]}>
            NOW
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.optionButton, schedule === 'Schedule' && styles.activeOptionButton]}
          onPress={() => setSchedule('Schedule')}
        >
          <Text style={[styles.optionButtonText, schedule === 'Schedule' && styles.activeOptionButtonText]}>
            SCHEDULE
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  const renderSaveOption = () => (
    <View style={styles.optionContainer}>
      <GlitchText text="SAVE TO BLOCKCHAIN" style={styles.optionTitle} intensity="low" />
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.optionButton, save === 'Yes' && styles.activeOptionButton]}
          onPress={() => setSave('Yes')}
        >
          <Text style={[styles.optionButtonText, save === 'Yes' && styles.activeOptionButtonText]}>
            YES
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.optionButton, save === 'No' && styles.activeOptionButton]}
          onPress={() => setSave('No')}
        >
          <Text style={[styles.optionButtonText, save === 'No' && styles.activeOptionButtonText]}>
            NO
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  const renderErrorMessage = () => {
    if (!error) return null;
    
    return (
      <View style={styles.errorContainer}>
        <FontAwesome name="exclamation-triangle" size={16} color={COLORS.accent} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  };
  
  const handleOutsidePress = () => {
    if (loading) return;
    onClose();
  };
  
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={handleOutsidePress}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <GlitchContainer 
              style={styles.modalContainer}
              intensity="medium"
              borderColor={COLORS.primary}
              backgroundColor={COLORS.background}
            >
              <LinearGradient
                colors={[COLORS.backgroundLight, COLORS.background]}
                style={styles.modalBackground}
              />
              
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoidingView}
              >
                <View style={styles.headerContainer}>
                  <GlitchText 
                    text="VIBESTREAM" 
                    style={styles.title} 
                    intensity="high" 
                  />
                  <Text style={styles.subtitle}>
                    POWERED BY {BRANDING.blockchain}
                  </Text>
                  
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={onClose}
                    disabled={loading}
                  >
                    <FontAwesome name="times" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView 
                  style={styles.scrollContent}
                  contentContainerStyle={styles.scrollContentContainer}
                  showsVerticalScrollIndicator={false}
                >
                  {renderErrorMessage()}
                  {renderModeSelection()}
                  {renderGroupOptions()}
                  {renderScheduleOptions()}
                  {renderSaveOption()}
                  
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountLabel}>CONNECTED:</Text>
                    <Text style={styles.accountId}>
                      {account?.accountId || 'NOT CONNECTED'}
                    </Text>
                  </View>
                  
                  <View style={styles.spacer} />
                </ScrollView>
                
                <View style={styles.footer}>
                  <AcidButton
                    text="CANCEL"
                    onPress={onClose}
                    type="secondary"
                    size="medium"
                    style={styles.cancelButton}
                    disabled={loading}
                  />
                  
                  <AcidButton
                    text={loading ? "STARTING..." : "START VIBING"}
                    onPress={handleStart}
                    type="primary"
                    size="medium"
                    disabled={loading}
                    style={styles.startButton}
                    showLoadingIndicator={loading}
                    pulsate={!loading}
                  />
                </View>
              </KeyboardAvoidingView>
            </GlitchContainer>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
    maxWidth: 450,
    maxHeight: '85%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  keyboardAvoidingView: {
    flex: 1,
    width: '100%',
  },
  headerContainer: {
    padding: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.primary}40`,
    alignItems: 'center',
    position: 'relative',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 4,
    color: COLORS.primary,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 5,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  optionContainer: {
    marginBottom: 25,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 10,
    letterSpacing: 2,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  optionSubtitle: {
    fontSize: 12,
    color: COLORS.secondary,
    marginLeft: 8,
    letterSpacing: 1,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: COLORS.textTertiary,
    borderRadius: 4,
    alignItems: 'center',
  },
  activeOptionButton: {
    backgroundColor: `${COLORS.primary}20`,
    borderColor: COLORS.primary,
  },
  optionButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  activeOptionButtonText: {
    color: COLORS.primary,
  },
  textInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: COLORS.textTertiary,
    borderRadius: 4,
    padding: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
    letterSpacing: 1,
  },
  entryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  entryInput: {
    flex: 1,
  },
  noCap: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: `${COLORS.accent}20`,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 4,
    justifyContent: 'center',
  },
  noCapText: {
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
    borderRadius: 4,
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
  accountInfo: {
    marginTop: 10,
    padding: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderWidth: 1,
    borderColor: `${COLORS.secondary}40`,
    borderRadius: 4,
  },
  accountLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  accountId: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  spacer: {
    height: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 15,
    gap: 15,
    borderTopWidth: 1,
    borderTopColor: `${COLORS.primary}40`,
  },
  cancelButton: {
    flex: 1,
  },
  startButton: {
    flex: 2,
  },
});

export default VibestreamModal;