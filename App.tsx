import React, { useState, useEffect } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  Platform,
  Switch,
  FlatList,
  TouchableOpacity,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

const chunkString = (str: string, size: number): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
};

interface Stats {
  width?: number;
  height?: number;
  size: number;
  filename?: string;
  type?: string;
}

interface FileData {
  base64: string;
  mimeType: string;
  filename: string;
  size: number;
}

interface ImageState {
  originalUri: string | null;
  uri: string | null;
  base64: string;
  chunks: string[];
  stats: Stats | null;
  originalStats: Stats | null;
}

interface FileState {
  data: FileData | null;
  base64: string;
  chunks: string[];
  stats: Stats | null;
}

export default function App() {
  // Estados separados para imagen y archivo
  const [imageState, setImageState] = useState<ImageState>({
    originalUri: null,
    uri: null,
    base64: "",
    chunks: [],
    stats: null,
    originalStats: null,
  });

  const [fileState, setFileState] = useState<FileState>({
    data: null,
    base64: "",
    chunks: [],
    stats: null,
  });

  const [compress, setCompress] = useState(true);
  const [quality, setQuality] = useState(0.7);
  const [maxSize, setMaxSize] = useState(512);
  const [chunkSize, setChunkSize] = useState(20000);
  const [imageDecode, setImageDecode] = useState("");
  const [fileDecode, setFileDecode] = useState("");
  const [selectedTab, setSelectedTab] = useState<"image" | "file">("image");

  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        await MediaLibrary.requestPermissionsAsync();
      }
    })();
  }, []);

  useEffect(() => {
    if (imageState.originalUri && selectedTab === "image") {
      processImage(imageState.originalUri);
    }
  }, [compress, quality, maxSize]);

  useEffect(() => {
    // Actualizar chunks cuando cambia el tamaño
    if (selectedTab === "image" && imageState.base64) {
      setImageState((prev) => ({
        ...prev,
        chunks: chunkString(prev.base64, chunkSize),
      }));
    } else if (selectedTab === "file" && fileState.base64) {
      setFileState((prev) => ({
        ...prev,
        chunks: chunkString(prev.base64, chunkSize),
      }));
    }
  }, [chunkSize]);

  const processImage = async (imgUri: string) => {
    const orig = await ImageManipulator.manipulateAsync(imgUri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });

    if (orig.base64) {
      const b64orig = `data:image/jpeg;base64,${orig.base64}`;
      const origSize = Math.round(b64orig.length * 0.75);
      const origStats = {
        width: orig.width,
        height: orig.height,
        size: origSize,
      };

      if (!compress) {
        setImageState({
          originalUri: imgUri,
          uri: orig.uri,
          base64: b64orig,
          chunks: chunkString(b64orig, chunkSize),
          stats: origStats,
          originalStats: origStats,
        });
        return;
      }

      const maxSide = Math.max(orig.width, orig.height);
      let targetW = orig.width;
      let targetH = orig.height;

      if (maxSide > maxSize) {
        const scale = maxSize / maxSide;
        targetW = Math.round(orig.width * scale);
        targetH = Math.round(orig.height * scale);
      }

      const compressed = await ImageManipulator.manipulateAsync(
        imgUri,
        [{ resize: { width: targetW, height: targetH } }],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (compressed.base64) {
        const b64 = `data:image/jpeg;base64,${compressed.base64}`;
        const compSize = Math.round(b64.length * 0.75);

        setImageState({
          originalUri: imgUri,
          uri: compressed.uri,
          base64: b64,
          chunks: chunkString(b64, chunkSize),
          stats: {
            width: compressed.width,
            height: compressed.height,
            size: compSize,
          },
          originalStats: origStats,
        });
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: false,
      quality: 1,
    });

    if (!result.canceled) {
      const img = result.assets[0].uri;
      await processImage(img);
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const picked = result.assets[0];
      const file = new File(picked.uri);
      const base64 = await file.base64();

      const mimeType = picked.mimeType || "application/octet-stream";
      const dataUri = `data:${mimeType};base64,${base64}`;
      const fileSize = Math.round(dataUri.length * 0.75);

      const fileInfo: FileData = {
        base64: dataUri,
        mimeType,
        filename: picked.name,
        size: picked.size || fileSize,
      };

      setFileState({
        data: fileInfo,
        base64: dataUri,
        chunks: chunkString(dataUri, chunkSize),
        stats: {
          size: fileSize,
          filename: picked.name,
          type: mimeType,
        },
      });
    } catch (err) {
      console.error("Error picking file:", err);
      Alert.alert("Error", "Could not read file");
    }
  };

  const saveImageToGallery = async () => {
    const b64 = selectedTab === "image" ? imageDecode : fileDecode;

    if (!b64.startsWith("data:image")) {
      Alert.alert("Error", "Not a valid image Base64");
      return;
    }

    try {
      const { uri } = await ImageManipulator.manipulateAsync(b64, [], {
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      await MediaLibrary.createAssetAsync(uri);
      Alert.alert("Success", "Image saved to gallery");
    } catch (err) {
      console.error("Error saving:", err);
      Alert.alert("Error", "Could not save image");
    }
  };

  const saveFileFromBase64 = async () => {
    const b64 = selectedTab === "image" ? imageDecode : fileDecode;

    if (!b64.startsWith("data:")) {
      Alert.alert("Error", "Invalid Base64 format");
      return;
    }

    try {
      const match = b64.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        Alert.alert("Error", "Invalid data URI format");
        return;
      }

      const [, mimeType, base64Data] = match;
      const extension = getExtensionFromMime(mimeType);
      const filename = `file_${Date.now()}${extension}`;

      const file = new File(Paths.document, filename);
      await file.write(base64Data, { encoding: "base64" });

      if (mimeType.startsWith("image/")) {
        await MediaLibrary.createAssetAsync(file.uri);
        Alert.alert("Success", "Image saved to gallery");
      } else {
        Alert.alert("Success", `File saved: ${filename}`);
      }
    } catch (err) {
      console.error("Error saving file:", err);
      Alert.alert("Error", "Could not save file");
    }
  };

  const getExtensionFromMime = (mimeType: string): string => {
    const mimeMap: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "application/pdf": ".pdf",
      "text/plain": ".txt",
      "application/zip": ".zip",
      "audio/mpeg": ".mp3",
      "video/mp4": ".mp4",
      "application/json": ".json",
    };
    return mimeMap[mimeType] || "";
  };

  const copyChunk = async (chunk: string, index: number) => {
    await Clipboard.setStringAsync(chunk);
    Alert.alert("Copied", `Fragment ${index + 1} copied to clipboard`);
  };

  const copyAll = async () => {
    const base64 =
      selectedTab === "image" ? imageState.base64 : fileState.base64;
    await Clipboard.setStringAsync(base64);
    Alert.alert("Success", "Complete Base64 copied to clipboard");
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return "Image";
    if (mimeType.startsWith("audio/")) return "Audio";
    if (mimeType.startsWith("video/")) return "Video";
    if (mimeType.includes("pdf")) return "PDF";
    if (mimeType.includes("zip")) return "Archive";
    if (mimeType.includes("text")) return "Text";
    return "File";
  };

  // Obtener el estado actual según la tab seleccionada
  const currentBase64 =
    selectedTab === "image" ? imageState.base64 : fileState.base64;
  const currentChunks =
    selectedTab === "image" ? imageState.chunks : fileState.chunks;
  const currentStats =
    selectedTab === "image" ? imageState.stats : fileState.stats;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Base64 Converter</Text>

          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, selectedTab === "image" && styles.tabActive]}
              onPress={() => setSelectedTab("image")}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTab === "image" && styles.tabTextActive,
                ]}
              >
                Image
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === "file" && styles.tabActive]}
              onPress={() => setSelectedTab("file")}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTab === "file" && styles.tabTextActive,
                ]}
              >
                File
              </Text>
            </TouchableOpacity>
          </View>

          {/* Image Compression Settings */}
          {selectedTab === "image" && (
            <View style={styles.card}>
              <View style={styles.settingRow}>
                <Text style={styles.label}>Compression</Text>
                <Switch
                  value={compress}
                  onValueChange={(v) => setCompress(v)}
                  trackColor={{ false: "#E5E5E5", true: "#000000" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {compress && (
                <View style={styles.settingsPanel}>
                  <View style={styles.settingGroup}>
                    <Text style={styles.settingLabel}>
                      Quality: {Math.round(quality * 100)}%
                    </Text>
                    <View style={styles.buttonGroup}>
                      {[0.3, 0.5, 0.7, 0.9].map((val) => (
                        <TouchableOpacity
                          key={val}
                          style={[
                            styles.optionButton,
                            quality === val && styles.optionButtonActive,
                          ]}
                          onPress={() => setQuality(val)}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              quality === val && styles.optionTextActive,
                            ]}
                          >
                            {Math.round(val * 100)}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.settingGroup}>
                    <Text style={styles.settingLabel}>
                      Max Size: {maxSize}px
                    </Text>
                    <View style={styles.buttonGroup}>
                      {[128, 256, 512, 1024].map((val) => (
                        <TouchableOpacity
                          key={val}
                          style={[
                            styles.optionButton,
                            maxSize === val && styles.optionButtonActive,
                          ]}
                          onPress={() => setMaxSize(val)}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              maxSize === val && styles.optionTextActive,
                            ]}
                          >
                            {val}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Chunk Size Setting (for all types) */}
          <View style={styles.card}>
            <View style={styles.settingGroup}>
              <Text style={styles.settingLabel}>
                Chunk Size: {(chunkSize / 1000).toFixed(0)}k
              </Text>
              <View style={styles.buttonGroup}>
                {[10000, 20000, 30000, 50000].map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.optionButton,
                      chunkSize === val && styles.optionButtonActive,
                    ]}
                    onPress={() => setChunkSize(val)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        chunkSize === val && styles.optionTextActive,
                      ]}
                    >
                      {val / 1000}k
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Encode Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Encode</Text>

            {selectedTab === "image" ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={pickImage}
              >
                <Text style={styles.primaryButtonText}>Select Image</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primaryButton} onPress={pickFile}>
                <Text style={styles.primaryButtonText}>Select File</Text>
              </TouchableOpacity>
            )}

            {selectedTab === "image" && imageState.uri && (
              <>
                <Image
                  source={{ uri: imageState.uri }}
                  style={styles.preview}
                  resizeMode="contain"
                />

                {currentStats && (
                  <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Dimensions</Text>
                      <Text style={styles.statValue}>
                        {currentStats.width} × {currentStats.height}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Size</Text>
                      <Text style={styles.statValue}>
                        {formatBytes(currentStats.size)}
                      </Text>
                    </View>
                    {imageState.originalStats && compress && (
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Reduced</Text>
                        <Text style={styles.statValue}>
                          {Math.round(
                            (1 -
                              currentStats.size /
                                imageState.originalStats.size) *
                              100
                          )}
                          %
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            {selectedTab === "file" && fileState.data && (
              <>
                <View style={styles.filePreview}>
                  <Text style={styles.fileIcon}>
                    {getFileIcon(fileState.data.mimeType)}
                  </Text>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {fileState.data.filename}
                  </Text>
                  <Text style={styles.fileSize}>
                    {formatBytes(fileState.data.size)}
                  </Text>
                </View>

                {currentStats && (
                  <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Type</Text>
                      <Text style={styles.statValue}>
                        {getFileIcon(currentStats.type || "")}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Size</Text>
                      <Text style={styles.statValue}>
                        {formatBytes(currentStats.size)}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}

            {currentBase64 && currentChunks.length > 0 && (
              <View style={styles.chunksSection}>
                <View style={styles.chunksHeader}>
                  <Text style={styles.chunksTitle}>
                    Fragments: {currentChunks.length}
                  </Text>
                  <Text style={styles.chunksSubtitle}>
                    {currentBase64.length.toLocaleString()} characters
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={copyAll}
                >
                  <Text style={styles.secondaryButtonText}>
                    Copy Complete Base64
                  </Text>
                </TouchableOpacity>

                <FlatList
                  data={currentChunks}
                  keyExtractor={(_, idx) => String(idx)}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={styles.chunkItem}
                      onPress={() => copyChunk(item, index)}
                    >
                      <Text style={styles.chunkNumber}>
                        Fragment {index + 1}
                      </Text>
                      <Text style={styles.chunkSize}>
                        {Math.round(item.length / 1000)}k chars
                      </Text>
                    </TouchableOpacity>
                  )}
                  scrollEnabled={false}
                />
              </View>
            )}
          </View>

          {/* Decode Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Decode</Text>
            <TextInput
              style={styles.input}
              multiline
              placeholder="Paste Base64 string here..."
              placeholderTextColor="#999"
              value={selectedTab === "image" ? imageDecode : fileDecode}
              onChangeText={
                selectedTab === "image" ? setImageDecode : setFileDecode
              }
            />
            {selectedTab === "image" &&
              imageDecode.startsWith("data:image") && (
                <Image
                  source={{ uri: imageDecode }}
                  style={styles.preview}
                  resizeMode="contain"
                />
              )}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={
                (selectedTab === "image" ? imageDecode : fileDecode).startsWith(
                  "data:image"
                )
                  ? saveImageToGallery
                  : saveFileFromBase64
              }
            >
              <Text style={styles.secondaryButtonText}>
                {(selectedTab === "image"
                  ? imageDecode
                  : fileDecode
                ).startsWith("data:image")
                  ? "Save to Gallery"
                  : "Save File"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 24,
    color: "#000",
    letterSpacing: -0.5,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#999",
  },
  tabTextActive: {
    color: "#000",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    color: "#000",
    letterSpacing: -0.3,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  settingsPanel: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  settingGroup: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 10,
    color: "#666",
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
  },
  optionButtonActive: {
    backgroundColor: "#000000",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  optionTextActive: {
    color: "#FFFFFF",
  },
  primaryButton: {
    backgroundColor: "#000000",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#F5F5F5",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
  preview: {
    width: "100%",
    height: 200,
    marginVertical: 16,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  filePreview: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: "#F9F9F9",
    borderRadius: 8,
    marginVertical: 16,
  },
  fileIcon: {
    fontSize: 48,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  fileName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  fileSize: {
    fontSize: 14,
    color: "#999",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 8,
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  chunksSection: {
    marginTop: 8,
  },
  chunksHeader: {
    marginBottom: 12,
  },
  chunksTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  chunksSubtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 2,
  },
  chunkItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 8,
    marginTop: 8,
  },
  chunkNumber: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
  },
  chunkSize: {
    fontSize: 14,
    color: "#999",
  },
  input: {
    height: 120,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#000",
    textAlignVertical: "top",
    backgroundColor: "#FAFAFA",
  },
});
