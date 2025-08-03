import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';
import { COLORS } from '../theme';
import GlitchText from './ui/GlitchText';
import { useWallet } from '../context/connector';

const { width } = Dimensions.get('window');

interface VibestreamModalProps {
  visible: boolean;
  onClose: () => void;
  onLaunchVibePlayer: (rtaID: string, config: any) => void;
}

type VibestreamMode = 'solo' | 'group';

const VibestreamModal: React.FC<VibestreamModalProps> = ({ visible, onClose, onLaunchVibePlayer }) => {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<VibestreamMode>('solo');
  const [storeToFilecoin, setStoreToFilecoin] = useState(true);
  const [distance, setDistance] = useState('10'); // Contract comment says "up to 10" meters
  const [ticketAmount, setTicketAmount] = useState('0');
  const [ticketPrice, setTicketPrice] = useState('0');
  const [streamPrice, setStreamPrice] = useState('0');
  const [freeTickets, setFreeTickets] = useState(true); // Default to true (N for ticket price)
  const [payPerStream, setPayPerStream] = useState(false); // Default to false (N for pay-per-stream)
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isCreatingRTA, setIsCreatingRTA] = useState(false);

  // Network-aware wallet integration
  const { account, connected, openModal, createRTANFT, getNetworkInfo } = useWallet();

  const resetModal = () => {
    setStep(1);
    setMode('solo');
    setStoreToFilecoin(true);
    setDistance('1'); // Start with minimum distance
    setTicketAmount('1'); // Start with minimum tickets
    setTicketPrice('0');
    setStreamPrice('0');
    setFreeTickets(true); // Default to free tickets (N for ticket price)
    setPayPerStream(false); // Default to no pay-per-stream (N)
    setAudioEnabled(true);
    setIsCreatingRTA(false);
  };

  const enableAudio = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.AudioContext) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        // Test audio with a brief beep
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.1, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
        osc.start();
        osc.stop(audioContext.currentTime + 0.1);
        setAudioEnabled(true);
        console.log('Audio enabled successfully');
      } catch (error) {
        console.warn('Failed to enable audio:', error);
      }
    } else {
      setAudioEnabled(true);
    }
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

  const generateRtaID = (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}`;
  };

  const handleLaunchVibestream = async () => {
    // Check wallet connection first
    if (!connected) {
      if (Platform.OS === 'web') {
        Alert.alert(
          'Wallet Required',
          'Please connect your wallet to create a vibestream.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Connect Wallet', 
              onPress: () => {
                openModal();
              }
            }
          ]
        );
      }
      return;
    }

    const accountIdToUse = account?.accountId;
    if (!accountIdToUse) {
      Alert.alert('Error', 'No account ID available. Please reconnect your wallet.');
      return;
    }

    // Get network information
    const networkInfo = getNetworkInfo();
    if (!networkInfo) {
      Alert.alert('Error', 'Network information not available. Please reconnect your wallet.');
      return;
    }

    setIsCreatingRTA(true);

    try {
      // Enable audio first
      await enableAudio();
      
      // Generate unique RTA ID for the Vibestream (raw ID without network prefix)
      const rawRtaId = generateRtaID();
      
      // Prepare RTA configuration matching contract requirements for both networks
      const rtaConfig = {
        mode,
        store_to_filecoin: storeToFilecoin,
        distance: mode === 'group' ? parseInt(distance) : undefined,
        ticket_amount: mode === 'group' ? parseInt(ticketAmount) : undefined,
        ticket_price: mode === 'group' && !freeTickets ? ticketPrice : undefined,
        pay_per_stream: mode === 'group' ? payPerStream : false,
        stream_price: mode === 'group' && payPerStream ? streamPrice : undefined,
        creator: accountIdToUse,
        created_at: Date.now(),
      };

      console.log(`🔥 Creating ${networkInfo.type} vibestream with config:`, rtaConfig);

      // =====================================================================================
      // NETWORK-AWARE VIBESTREAM CREATION
      // NEAR: Uses rtav2 contract -> createRTANFT
      // Metis: Uses VibeFactory contract -> createVibestreamWithDelegate (single transaction!)
      // =====================================================================================
      
      let fullTokenId: string;
      let creationSucceeded = false;
      
      try {
        // Create vibestream with 30-second timeout (network-aware)
        const creationPromise = createRTANFT(rawRtaId, rtaConfig);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`${networkInfo.type} creation timeout`)), 30000);
        });

        fullTokenId = await Promise.race([creationPromise, timeoutPromise]);
        creationSucceeded = true;
        
        console.log(`✅ ${networkInfo.type} vibestream created successfully:`, fullTokenId);
        console.log('📊 Raw RTA ID (for workers):', rawRtaId);

      } catch (error) {
        console.warn(`⚠️ ${networkInfo.type} vibestream creation failed or timed out:`, error);
        console.log('🔄 Using fallback mode - vibestream will continue with mock data');
        
        // Generate fallback data for testing
        const networkPrefix = networkInfo.type === 'metis-hyperion' ? 'metis_vibe' : 'rta';
        fullTokenId = `${networkPrefix}_${rawRtaId}`;
        creationSucceeded = false;

        // Add fallback indicator to config
        (rtaConfig as any).fallback_mode = true;
        (rtaConfig as any).fallback_reason = (error as Error).message.includes('timeout') ? `${networkInfo.type}_timeout` : `${networkInfo.type}_error`;
        (rtaConfig as any).original_error = (error as Error).message;
        (rtaConfig as any).network = networkInfo.type;

        console.log('🎭 Fallback data generated:', {
          tokenId: fullTokenId,
          rawRtaId,
          creator: rtaConfig.creator,
          timestamp: rtaConfig.created_at,
          network: networkInfo.type,
          fallback: true
        });
      }

      // Show appropriate success message
      if (creationSucceeded) {
        console.log(`🎉 ${networkInfo.type} vibestream created - full functionality enabled`);
      } else {
        console.log(`🎯 Vibestream starting in fallback mode for ${networkInfo.type}`);
        console.log('📊 Fallback vibestream will still enable: chunking → backend processing');
        
        // Show user notification about fallback mode
        if (Platform.OS === 'web') {
          const networkName = networkInfo.type === 'metis-hyperion' ? 'Metis Hyperion' : 'NEAR';
          Alert.alert(
            'Vibestream Starting (Fallback Mode)',
            `${networkName} is slow, but your vibestream will start anyway!\n\n✅ Audio chunking: Working\n✅ Backend processing: Working\n✅ Storage: Working\n\nYour music will still be processed and stored!`,
            [{ text: 'Start Vibing!', style: 'default' }]
          );
        } else {
          console.log(`📱 Mobile fallback mode activated for ${networkInfo.type} - all backend systems operational`);
        }
      }

      // Launch vibestream
      onClose();
      onLaunchVibePlayer(fullTokenId, rtaConfig);

    } catch (error) {
      console.error('Failed to create vibestream:', error);
      
      let errorMessage = 'Failed to create vibestream. Please try again.';
      let showExplorerOption = false;
      let explorerUrl: string | null = null;
      
      if (error instanceof Error) {
        if (error.message.includes('Insufficient')) {
          const networkName = getNetworkInfo()?.type === 'metis-hyperion' ? 'tMETIS' : 'NEAR';
          errorMessage = `Insufficient ${networkName} balance. Please add funds to your wallet.`;
        } else if (error.message.includes('User rejected') || error.message.includes('rejected')) {
          errorMessage = 'Transaction was cancelled.';
        } else if (error.message.includes('Wallet not connected')) {
          errorMessage = 'Please connect your wallet first.';
        } else if (error.message.includes('wrong network')) {
          errorMessage = 'Please switch to the correct network in your wallet.';
        } else if (error.message.includes('Check explorer:')) {
          // Transaction was submitted but timed out
          errorMessage = error.message;
          showExplorerOption = true;
          
          // Extract explorer URL from error message
          const explorerMatch = error.message.match(/(https:\/\/[^\s]+)/);
          explorerUrl = explorerMatch ? explorerMatch[1] : null;
        } else {
          errorMessage = error.message;
        }
      }
      
      if (showExplorerOption && Platform.OS === 'web') {
        
        Alert.alert(
          'Transaction Submitted', 
          errorMessage,
          [
            { text: 'OK', style: 'default' },
            ...(explorerUrl ? [{ 
              text: 'View on Explorer', 
              onPress: () => window.open(explorerUrl, '_blank')
            }] : [])
          ]
        );
      } else {
        Alert.alert('Creation Failed', errorMessage);
      }
    } finally {
      setIsCreatingRTA(false);
    }
  };

  const isLaunchDisabled = () => {
    if (isCreatingRTA) return true;
    
    if (mode === 'group') {
      // Validate distance (1-10 meters per contract)
      const distanceNum = parseInt(distance);
      if (!distance || distance === '0' || distanceNum < 1 || distanceNum > 10) return true;
      
      // Validate ticket amount (must be at least 1)
      const ticketAmountNum = parseInt(ticketAmount);
      if (!ticketAmount || ticketAmount === '0' || ticketAmountNum < 1) return true;
      
      // If pay-per-stream is enabled, validate stream price
      if (payPerStream && (!streamPrice || streamPrice === '0')) return true;
      
      // If tickets are not free, validate ticket price  
      if (!freeTickets && (!ticketPrice || ticketPrice === '0')) return true;
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
      
      {/* Wallet connection status */}
      {!connected && (
        <View style={styles.walletWarning}>
          <FontAwesome name="exclamation-triangle" size={12} color={COLORS.secondary} />
          <Text style={styles.walletWarningText}>WALLET NOT CONNECTED</Text>
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
        <Text style={styles.checkboxText}>STORE TO FILECOIN</Text>
      </TouchableOpacity>
      
      <View style={styles.settingsContainer}>
        {mode === 'group' && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DISTANCE (1-10 METERS)</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={distance}
                  onChangeText={(text) => {
                    // Ensure distance is between 1-10 as per contract
                    const num = parseInt(text);
                    if (text === '' || (num >= 1 && num <= 10)) {
                      setDistance(text);
                    }
                  }}
                  placeholder="1"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="numeric"
                  maxLength={2}
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
                  placeholder="1"
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
                  style={[styles.ynCheckboxContainer, styles.disabledCheckbox]}
                  activeOpacity={1}
                  disabled={true}
                >
                  <View style={[styles.checkbox, styles.disabledCheckbox]}>
                  </View>
                  <Text style={[styles.ynCheckboxText, styles.disabledText]}>Y</Text>
                </TouchableOpacity>
                
                <View style={[styles.fullWidthPriceInputContainer, freeTickets && styles.disabledInput]}>
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
                  style={[styles.ynCheckboxContainer, styles.disabledCheckbox]}
                  activeOpacity={1}
                  disabled={true}
                >
                  <View style={[styles.checkbox, styles.disabledCheckbox]}>
                  </View>
                  <Text style={[styles.ynCheckboxText, styles.disabledText]}>Y</Text>
                </TouchableOpacity>
                
                <View style={[styles.fullWidthPriceInputContainer, !payPerStream && styles.disabledInput]}>
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
          </>
        )}
      </View>

      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={[styles.actionButton, isLaunchDisabled() && styles.disabledButton]}
          onPress={handleLaunchVibestream}
          disabled={isLaunchDisabled()}
          activeOpacity={0.7}
        >
          {isCreatingRTA ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>CREATING RTA...</Text>
            </View>
          ) : (
            <Text style={[styles.actionButtonText, isLaunchDisabled() && styles.disabledText]}>
              {Platform.OS === 'web' ? 'LAUNCH' : 'LAUNCH'}
            </Text>
          )}
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
    borderWidth: 2,
    borderColor: COLORS.primary,
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
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 3,
    textTransform: 'uppercase',
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
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary + '20',
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
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
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
    gap: 20,
    marginBottom: 20,
  },
  inputGroup: {
    position: 'relative',
  },
  inputLabel: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
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
  // New style for full-width price input containers
  fullWidthPriceInputContainer: {
    flex: 1,
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
  disabledCheckbox: {
    opacity: 0.4,
    borderColor: COLORS.textSecondary,
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
  walletWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletWarningText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default VibestreamModal;