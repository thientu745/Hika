import { TouchableOpacity, Text, ViewStyle, TextStyle } from 'react-native';
import { ReactNode } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface ButtonProps {
  onPress: () => void;
  title?: string;
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  title,
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  style,
  textStyle,
}) => {
  const baseClasses = 'rounded-lg items-center justify-center';
  
  const variantClasses = {
    primary: 'bg-hika-darkgreen',
    secondary: 'bg-gray-100 border border-gray-300',
    outline: 'bg-transparent border-2 border-green-500',
  };

  const sizeClasses = {
    sm: 'py-2 px-4',
    md: 'py-3 px-6',
    lg: 'py-4 px-8',
  };

  const textVariantClasses = {
    primary: 'text-white',
    secondary: 'text-gray-900',
    outline: 'text-green-500',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className} ${disabled || loading ? 'opacity-50' : ''}`}
      style={style}
    >
      {loading ? (
        <LoadingSpinner 
          size="small" 
          color={variant === 'primary' ? 'white' : variant === 'outline' ? '#10b981' : '#111827'} 
        />
      ) : (
        children || (
          <Text className={`font-semibold ${textVariantClasses[variant]} ${textSizeClasses[size]}`} style={textStyle}>
            {title}
          </Text>
        )
      )}
    </TouchableOpacity>
  );
};

