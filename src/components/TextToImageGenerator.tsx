import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Copy, Download, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

type ImageFormat = 'png' | 'jpeg';
type ImageSize = '256' | '512' | '1024' | 'custom';

interface CustomSize {
  width: number;
  height: number;
}

export const TextToImageGenerator = () => {
  const [text, setText] = useState("");
  const [imageFormat, setImageFormat] = useState<ImageFormat>('png');
  const [imageSize, setImageSize] = useState<ImageSize>('256');
  const [customSize, setCustomSize] = useState<CustomSize>({ width: 256, height: 256 });
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getSizeDimensions = useCallback(() => {
    switch (imageSize) {
      case '256': return { width: 256, height: 256 };
      case '512': return { width: 512, height: 512 };
      case '1024': return { width: 1024, height: 1024 };
      case 'custom': return customSize;
      default: return { width: 256, height: 256 };
    }
  }, [imageSize, customSize]);

  const generateImage = useCallback(async () => {
    if (!text.trim()) {
      toast.error("Please enter some text to generate an image");
      return;
    }

    setIsGenerating(true);
    
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dimensions = getSizeDimensions();
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Create gradient background
      const gradient = ctx.createLinearGradient(0, 0, dimensions.width, dimensions.height);
      gradient.addColorStop(0, '#8b5cf6');
      gradient.addColorStop(1, '#a855f7');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Configure text styling
      const fontSize = Math.min(dimensions.width, dimensions.height) / 10;
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Add text shadow for better readability
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Word wrap functionality
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      const maxWidth = dimensions.width * 0.8;

      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }

      // Draw text lines
      const lineHeight = fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      const startY = (dimensions.height - totalHeight) / 2 + fontSize / 2;

      lines.forEach((line, index) => {
        const y = startY + index * lineHeight;
        ctx.fillText(line, dimensions.width / 2, y);
      });

      // Convert canvas to image
      const imageData = canvas.toDataURL(`image/${imageFormat}`, 0.9);
      setGeneratedImage(imageData);
      
      toast.success("Image generated successfully!");
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error("Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  }, [text, imageFormat, getSizeDimensions]);

  const copyToClipboard = useCallback(async () => {
    if (!generatedImage) return;

    try {
      // Convert data URL to blob
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      
      toast.success("Image copied to clipboard!");
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error("Failed to copy image to clipboard");
    }
  }, [generatedImage]);

  const downloadImage = useCallback(() => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.download = `text-image.${imageFormat}`;
    link.href = generatedImage;
    link.click();
    
    toast.success("Image downloaded!");
  }, [generatedImage, imageFormat]);

  const characterCount = text.length;
  const isTextValid = characterCount > 0 && characterCount <= 128;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 shadow-card bg-card/50 backdrop-blur-sm border-border/50">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-primary shadow-glow mb-4">
              <ImageIcon className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Text to Image Generator
            </h1>
            <p className="text-muted-foreground">
              Convert your text into beautiful images instantly
            </p>
          </div>

          {/* Text Input */}
          <div className="space-y-2">
            <Label htmlFor="text-input" className="text-sm font-medium">
              Enter your text (max 128 characters)
            </Label>
            <div className="relative">
              <Input
                id="text-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to convert to image..."
                maxLength={128}
                className="pr-16"
              />
              <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${
                characterCount > 128 ? 'text-destructive' : 'text-muted-foreground'
              }`}>
                {characterCount}/128
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Image Format</Label>
              <Select value={imageFormat} onValueChange={(value: ImageFormat) => setImageFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="jpeg">JPEG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Image Size</Label>
              <Select value={imageSize} onValueChange={(value: ImageSize) => setImageSize(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="256">256 × 256 px</SelectItem>
                  <SelectItem value="512">512 × 512 px</SelectItem>
                  <SelectItem value="1024">1024 × 1024 px</SelectItem>
                  <SelectItem value="custom">Custom Size</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Size Inputs */}
          {imageSize === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Width (px)</Label>
                <Input
                  type="number"
                  value={customSize.width}
                  onChange={(e) => setCustomSize(prev => ({ ...prev, width: parseInt(e.target.value) || 256 }))}
                  min="100"
                  max="2048"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Height (px)</Label>
                <Input
                  type="number"
                  value={customSize.height}
                  onChange={(e) => setCustomSize(prev => ({ ...prev, height: parseInt(e.target.value) || 256 }))}
                  min="100"
                  max="2048"
                />
              </div>
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={generateImage}
            disabled={!isTextValid || isGenerating}
            variant="gradient"
            className="w-full font-semibold transition-spring hover:shadow-glow"
            size="lg"
          >
            {isGenerating ? "Generating..." : "Generate Image"}
          </Button>

          {/* Generated Image Display */}
          {generatedImage && (
            <div className="space-y-4">
              <div className="text-center">
                <img
                  src={generatedImage}
                  alt="Generated text image"
                  className="max-w-full h-auto rounded-lg shadow-card mx-auto"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  className="flex-1"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </Button>
                <Button
                  onClick={downloadImage}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
      
      {/* Hidden Canvas */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};