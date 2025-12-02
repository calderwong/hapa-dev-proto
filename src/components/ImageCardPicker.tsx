// @ts-nocheck
import React, { useState, useEffect } from 'react';

interface LibraryImage {
  id: string;
  url: string;
  name: string;
  dataUrl?: string; // For base64 data
  mimeType?: string;
  thumbnail?: string;
}

interface ImageCardPickerProps {
  onSelect: (image: { base64: string; mimeType: string; name: string }) => void;
  onCancel: () => void;
  title?: string;
}

const ImageCardPicker: React.FC<ImageCardPickerProps> = ({
  onSelect,
  onCancel,
  title = 'Select Image',
}) => {
  const [tab, setTab] = useState<'library' | 'upload'>('library');
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<LibraryImage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [converting, setConverting] = useState(false);

  // Load images from card library
  useEffect(() => {
    const loadLibraryImages = async () => {
      if (!window.electronAPI?.p2pRead) {
        setLoading(false);
        return;
      }

      try {
        const libraryCore = await window.electronAPI.p2pRead('card-library');
        const images: LibraryImage[] = [];

        for (const record of libraryCore) {
          try {
            const indexData = JSON.parse(record);
            if (indexData.type === 'card-index' && indexData.coreName) {
              const cardRecords = await window.electronAPI.p2pRead(indexData.coreName);
              let cardData: any = null;

              for (const r of cardRecords) {
                try {
                  const p = JSON.parse(r);
                  if (p.type === 'card') cardData = p;
                } catch {}
              }

              if (cardData) {
                // Check if it's an image card
                const isImage =
                  cardData.kind === 'image' ||
                  cardData.mediaType === 'image' ||
                  cardData.mimeType?.startsWith('image/') ||
                  cardData.image?.dataUrl;

                if (isImage) {
                  // Get the image URL or data
                  let imageUrl = cardData.thumbnail || cardData.image?.dataUrl || cardData.imageUrl;
                  let dataUrl = cardData.image?.dataUrl;
                  let mimeType = cardData.image?.mimeType || cardData.mimeType || 'image/png';

                  // Handle wormhole ingested images
                  if (!imageUrl && cardData.wormhole?.ingest?.originalPath) {
                    imageUrl = `file://${cardData.wormhole.ingest.originalPath.replace(/\\/g, '/')}`;
                  }

                  if (imageUrl) {
                    images.push({
                      id: cardData.id || indexData.cardId,
                      url: imageUrl,
                      name: cardData.title || cardData.alt || cardData.model || 'Image',
                      dataUrl,
                      mimeType,
                      thumbnail: indexData.thumbnail || imageUrl,
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Failed to process library record', e);
          }
        }

        setLibraryImages(images.reverse()); // Newest first
      } catch (e) {
        console.error('Failed to load library images', e);
      } finally {
        setLoading(false);
      }
    };

    loadLibraryImages();
  }, []);

  // Filter images by search
  const filteredImages = libraryImages.filter((img) =>
    img.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Convert image URL to base64
  const convertToBase64 = async (image: LibraryImage): Promise<{ base64: string; mimeType: string }> => {
    // If we already have a dataUrl, extract base64
    if (image.dataUrl?.startsWith('data:')) {
      const match = image.dataUrl.match(/^data:(.*?);base64,(.*)$/);
      if (match) {
        return { base64: match[2], mimeType: match[1] };
      }
    }

    // For file:// URLs or http URLs, we need to fetch and convert
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const mimeType = blob.type || image.mimeType || 'image/png';

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1];
          resolve({ base64, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error('Failed to convert image to base64:', err);
      throw err;
    }
  };

  // Handle library image selection
  const handleSelectFromLibrary = async () => {
    if (!selectedImage) return;

    setConverting(true);
    try {
      const { base64, mimeType } = await convertToBase64(selectedImage);
      onSelect({ base64, mimeType, name: selectedImage.name });
    } catch (err) {
      console.error('Failed to select image:', err);
      alert('Failed to load image. Please try again or upload a new one.');
    } finally {
      setConverting(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      onSelect({ base64, mimeType: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-astro-dark border border-purple-500/30 rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-purple-900/20">
          <div className="flex items-center gap-2">
            <rux-icon icon="image" size="small" className="text-purple-400"></rux-icon>
            <span className="text-sm font-bold text-white">{title}</span>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Close"
          >
            <rux-icon icon="close" size="small"></rux-icon>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-purple-500/20">
          <button
            onClick={() => setTab('library')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === 'library'
                ? 'text-purple-300 border-b-2 border-purple-500 bg-purple-900/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <rux-icon icon="folder" size="extra-small"></rux-icon>
            Card Library
            <span className="text-xs text-purple-400/60 bg-purple-900/50 px-1.5 rounded">
              {libraryImages.length}
            </span>
          </button>
          <button
            onClick={() => setTab('upload')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === 'upload'
                ? 'text-purple-300 border-b-2 border-purple-500 bg-purple-900/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <rux-icon icon="cloud-upload" size="extra-small"></rux-icon>
            Upload New
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col">
          {tab === 'library' ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Search */}
              <div className="p-3 border-b border-purple-500/10">
                <div className="relative">
                  <rux-icon
                    icon="search"
                    size="extra-small"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400/50"
                  ></rux-icon>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search cards..."
                    className="w-full bg-purple-900/30 border border-purple-500/20 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-purple-400/50 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Image Grid - scrollable */}
              <div className="flex-1 overflow-y-scroll p-3 [min-height:0]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                    <span className="ml-2 text-sm text-purple-300">Loading cards...</span>
                  </div>
                ) : filteredImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <rux-icon icon="image-not-supported" size="large" className="text-purple-400/30 mb-2"></rux-icon>
                    <p className="text-sm text-purple-400/70">
                      {searchQuery ? 'No images match your search' : 'No image cards in library'}
                    </p>
                    <button
                      onClick={() => setTab('upload')}
                      className="mt-3 text-xs text-purple-400 hover:text-purple-300 underline"
                    >
                      Upload a new image
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {filteredImages.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => setSelectedImage(img)}
                        onDoubleClick={() => {
                          setSelectedImage(img);
                          handleSelectFromLibrary();
                        }}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all group ${
                          selectedImage?.id === img.id
                            ? 'border-purple-500 ring-2 ring-purple-500/50'
                            : 'border-transparent hover:border-purple-500/50'
                        }`}
                      >
                        <img
                          src={img.thumbnail || img.url}
                          alt={img.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-1">
                            <p className="text-[10px] text-white truncate">{img.name}</p>
                          </div>
                        </div>
                        {selectedImage?.id === img.id && (
                          <div className="absolute top-1 right-1 bg-purple-500 rounded-full p-0.5">
                            <rux-icon icon="check" size="extra-small" className="text-white"></rux-icon>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-6">
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-purple-500/30 rounded-xl cursor-pointer hover:border-purple-500/60 hover:bg-purple-900/10 transition-all">
                <rux-icon icon="cloud-upload" size="large" className="text-purple-400 mb-2"></rux-icon>
                <span className="text-sm text-purple-300 font-medium">Click to upload image</span>
                <span className="text-xs text-purple-400/60 mt-1">PNG, JPG, GIF, WebP supported</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer - only for library tab when image selected */}
        {tab === 'library' && selectedImage && (
          <div className="px-4 py-3 border-t border-purple-500/20 bg-purple-900/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src={selectedImage.thumbnail || selectedImage.url}
                alt=""
                className="w-10 h-10 rounded object-cover border border-purple-500/30"
              />
              <div>
                <p className="text-sm text-white font-medium truncate max-w-[200px]">
                  {selectedImage.name}
                </p>
                <p className="text-xs text-purple-400/60">Selected</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSelectFromLibrary}
                disabled={converting}
                className="px-4 py-2 text-sm bg-purple-500 hover:bg-purple-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {converting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <rux-icon icon="check" size="extra-small"></rux-icon>
                    Use This Image
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageCardPicker;
