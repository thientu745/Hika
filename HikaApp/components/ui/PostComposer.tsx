import React, { useState } from 'react';
import { View, TextInput, Text } from 'react-native';
import { Button } from './Button';
import { createPost } from '../../services/database';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  onPosted?: () => void;
}

export const PostComposer: React.FC<Props> = ({ onPosted }) => {
  const { user, userProfile } = useAuth();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !userProfile) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await createPost({
        userId: user.uid,
        userDisplayName: userProfile.displayName || (user.displayName || 'User'),
        userProfilePictureUrl: userProfile.profilePictureUrl || '',
        trailId: '',
        trailName: '',
        location: '',
        images: [],
        description: trimmed,
      } as any);

      setText('');
      if (onPosted) onPosted();
    } catch (e) {
      console.warn('Failed to create post', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="mb-4 bg-white">
      <Text className="text-gray-900 font-medium mb-2">Create Post</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Share something about your hike..."
        className="border border-gray-200 rounded-lg p-3 min-h-[80px] text-gray-900"
      />
      <View className="mt-3 items-end">
        <Button title="Post" onPress={handleSubmit} loading={submitting} />
      </View>
    </View>
  );
};

export default PostComposer;
