import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, SPACING, BRANDING } from '../theme';
import GlitchContainer from './ui/GlitchContainer';
import AcidButton from './ui/AcidButton';

const { width } = Dimensions.get('window');

interface UserProfileProps {
  accountId: string;
  onCreateVibestream: () => void;
  onBack: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ 
  accountId, 
  onCreateVibestream,
  onBack 
}) => {
  const [vibestreams] = useState<any[]>([]); // Initially empty as requested

  const renderVibestreamGrid = () => {
    const gridItems = [...vibestreams];
    
    // Add the create new vibestream button
    gridItems.push({ id: 'create-new', isCreateButton: true });

    return (
      <View style={styles.grid}>
        {gridItems.map((item, index) => (
          <TouchableOpacity
            key={item.id || index}
            style={styles.gridItem}
            onPress={item.isCreateButton ? onCreateVibestream : undefined}
            activeOpacity={0.8}
          >
            <GlitchContainer 
              style={styles.gridItemContainer}
              intensity="low"
              animated={item.isCreateButton}
            >
              {item.isCreateButton ? (
                <View style={styles.createButton}>
                  <FontAwesome5 
                    name="plus" 
                    size={24} 
                    color={COLORS.primary} 
                  />
                </View>
              ) : (
                <View style={styles.vibestreamThumbnail}>
                  <FontAwesome5 
                    name="music" 
                    size={20} 
                    color={COLORS.accent} 
                  />
                  <Text style={styles.vibestreamTitle}>
                    {item.title}
                  </Text>
                  <Text style={styles.vibestreamDate}>
                    {item.date}
                  </Text>
                </View>
              )}
            </GlitchContainer>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PROFILE</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <GlitchContainer 
            style={styles.avatarContainer} 
            intensity="medium"
            animated={true}
          >
            <View style={styles.avatar}>
              <FontAwesome5 
                name="user-astronaut" 
                size={48} 
                color={COLORS.primary} 
              />
            </View>
          </GlitchContainer>
          
          <Text style={styles.accountName}>{accountId}</Text>
          <Text style={styles.accountType}>NEAR PROTOCOL</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>VIBESTREAMS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0:00:00</Text>
              <Text style={styles.statLabel}>TOTAL TIME</Text>
            </View>
          </View>
        </View>

        {/* Vibestreams Section */}
        <View style={styles.vibestreamsSection}>
          <Text style={styles.sectionTitle}>YOUR VIBESTREAMS</Text>
          <Text style={styles.sectionSubtitle}>
            ARCHIVED · FREQUENCIES · CAPTURED
          </Text>
          
          {renderVibestreamGrid()}
        </View>

        {/* Brand Footer */}
        <View style={styles.brandFooter}>
          <Text style={styles.brandText}>{BRANDING.manifesto}</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.md,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: 2,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  avatarContainer: {
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  accountName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    letterSpacing: 1,
  },
  accountType: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.accent,
    marginBottom: SPACING.lg,
    letterSpacing: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: 'monospace',
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
    letterSpacing: 1,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.primary + '40',
    marginHorizontal: SPACING.lg,
  },
  vibestreamsSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    letterSpacing: 2,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: (width - SPACING.lg * 2 - SPACING.md) / 2,
    marginBottom: SPACING.md,
  },
  gridItemContainer: {
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
  },
  createButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  vibestreamThumbnail: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
    padding: SPACING.sm,
  },
  vibestreamTitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  vibestreamDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  brandFooter: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  brandText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 16,
  },
});

export default UserProfile;