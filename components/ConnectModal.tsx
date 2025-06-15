import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

interface ConnectModalProps {
  visible: boolean;
  onClose: () => void;
}

const ConnectModal: React.FC<ConnectModalProps> = ({ visible, onClose }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Connect Wallet</Text>
          <Text style={styles.subtitle}>Choose your preferred wallet to connect</Text>
          
          <TouchableOpacity style={styles.walletButton} onPress={onClose}>
            <Text style={styles.walletText}>Sui Wallet</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.walletButton} onPress={onClose}>
            <Text style={styles.walletText}>Ethos Wallet</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  modalContainer: {
    backgroundColor: COLORS.backgroundLight,
    padding: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    width: '80%',
    alignItems: 'center',
  },
  title: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 2,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 30,
    textAlign: 'center',
  },
  walletButton: {
    width: '100%',
    padding: 15,
    backgroundColor: 'rgba(0, 255, 170, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: 15,
    alignItems: 'center',
  },
  walletText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  closeButton: {
    marginTop: 10,
    padding: 10,
  },
  closeText: {
    color: COLORS.textTertiary,
    fontSize: 14,
  },
});

export default ConnectModal;