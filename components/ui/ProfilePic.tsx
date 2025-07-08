import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, Platform } from 'react-native';
import { PINATA_JWT, PINATA_URL } from '@env';
import { COLORS } from '../../theme';

interface AuthenticatedImageProps {
  ipfsHash: string;
  style?: any;
  placeholder?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
}

const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  ipfsHash,
  style,
  placeholder,
  onLoad,
  onError
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchAuthenticatedImage();
  }, [ipfsHash]);

  const fetchAuthenticatedImage = async () => {
    if (!ipfsHash) {
      setError(true);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(false);

      const url = `https://${PINATA_URL}/ipfs/${ipfsHash}`;
      
      // For web, we can use authenticated fetch
      if (Platform.OS === 'web') {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${PINATA_JWT}`,
            'Accept': 'image/*'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setImageUri(objectUrl);
      } else {
        // For mobile, try direct URL first (some gateways are public)
        // If that fails, you might need to implement a proxy server
        setImageUri(url);
      }

      onLoad?.();
    } catch (err) {
      console.error('Failed to load authenticated image:', err);
      setError(true);
      onError?.();
    } finally {
      setLoading(false);
    }
  };

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (imageUri && Platform.OS === 'web' && imageUri.startsWith('blob:')) {
        URL.revokeObjectURL(imageUri);
      }
    };
  }, [imageUri]);

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        {placeholder || <View style={styles.loadingPlaceholder} />}
      </View>
    );
  }

  if (error || !imageUri) {
    return (
      <View style={[styles.container, style]}>
        {placeholder || <View style={styles.errorPlaceholder} />}
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUri || '' }}
      style={[styles.image, style]}
      onLoad={onLoad}
      onError={() => {
        setError(true);
        onError?.();
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.backgroundLight,
    opacity: 0.6,
  },
  errorPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.backgroundLight,
    opacity: 0.3,
  },
});

export default AuthenticatedImage; 