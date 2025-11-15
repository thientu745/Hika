import { TextInput, Text, View, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerClassName = '',
  labelClassName = '',
  inputClassName = '',
  errorClassName = '',
  ...textInputProps
}) => {
  return (
    <View className={`mb-4 ${containerClassName}`}>
      {label && (
        <Text className={`text-gray-700 mb-2 font-medium ${labelClassName}`}>
          {label}
        </Text>
      )}
      <TextInput
        className={`border rounded-lg px-4 py-3 text-base ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${inputClassName}`}
        placeholderTextColor="#9CA3AF"
        {...textInputProps}
      />
      {error && (
        <Text className={`text-red-500 text-sm mt-1 ${errorClassName}`}>
          {error}
        </Text>
      )}
    </View>
  );
};

