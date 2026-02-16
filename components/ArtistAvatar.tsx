import Image from 'next/image';

interface ArtistAvatarProps {
  imageUrl?: string | null;
  name: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  priority?: boolean;
  className?: string;
}

const sizeMap = {
  small: { width: 96, height: 96, fontSize: 'text-xl' },
  medium: { width: 192, height: 192, fontSize: 'text-3xl' },
  large: { width: 256, height: 256, fontSize: 'text-4xl' },
  xlarge: { width: 384, height: 384, fontSize: 'text-6xl' },
};

export default function ArtistAvatar({
  imageUrl,
  name,
  size = 'medium',
  priority = false,
  className = '',
}: ArtistAvatarProps) {
  const { width, height, fontSize } = sizeMap[size];
  const initial = name.charAt(0).toUpperCase();

  if (!imageUrl) {
    return (
      <div
        className={`bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold ${fontSize} ${className}`}
        style={{ width, height }}
      >
        {initial}
      </div>
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={name}
      width={width}
      height={height}
      priority={priority}
      className={className}
      sizes={`(max-width: 768px) ${width / 2}px, ${width}px`}
    />
  );
}
