import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Copy, Download, Image as ImageIcon, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type ImageFormat = 'png' | 'jpeg';
type ImageSize = '256' | '512' | '1024' | 'custom';
type ColorScheme = 'purple' | 'blue' | 'green' | 'orange' | 'dark' | 'light';
type ImageShape = 'rectangle' | 'rounded' | 'circle' | 'rhombus' | 'triangle' | 'hexagon' | 'star';

interface CustomSize {
  width: number;
  height: number;
}

interface ColorSchemeConfig {
  background: string[];
  text: string;
}

const COLOR_SCHEMES: Record<ColorScheme, ColorSchemeConfig> = {
  purple: { background: ['#8b5cf6', '#a855f7'], text: '#ffffff' },
  blue: { background: ['#3b82f6', '#1d4ed8'], text: '#ffffff' },
  green: { background: ['#10b981', '#059669'], text: '#ffffff' },
  orange: { background: ['#f97316', '#ea580c'], text: '#ffffff' },
  dark: { background: ['#1f2937', '#111827'], text: '#ffffff' },
  light: { background: ['#f8fafc', '#e2e8f0'], text: '#1f2937' }
};

interface ShapeConfig {
  clipFunction: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  textArea: (width: number, height: number) => { width: number; height: number; offsetX: number; offsetY: number; fontScale: number };
}

const SHAPE_OPTIONS: Record<ImageShape, ShapeConfig> = {
  rectangle: {
    clipFunction: () => {}, // No clipping needed
    textArea: (width, height) => ({ width: width * 0.8, height: height * 0.8, offsetX: 0, offsetY: 0, fontScale: 1 })
  },
  rounded: {
    clipFunction: (ctx, width, height) => {
      ctx.beginPath();
      ctx.roundRect(0, 0, width, height, 16);
      ctx.clip();
    },
    textArea: (width, height) => ({ width: width * 0.8, height: height * 0.8, offsetX: 0, offsetY: 0, fontScale: 1 })
  },
  circle: {
    clipFunction: (ctx, width, height) => {
      const radius = Math.min(width, height) / 2;
      const centerX = width / 2;
      const centerY = height / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.clip();
    },
    textArea: (width, height) => {
      // Inscribed square in circle
      const diameter = Math.min(width, height);
      const textSize = diameter * 0.7; // √2/2 ≈ 0.707
      return { width: textSize, height: textSize, offsetX: 0, offsetY: 0, fontScale: 0.9 };
    }
  },
  rhombus: {
    clipFunction: (ctx, width, height) => {
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width, height / 2);
      ctx.lineTo(width / 2, height);
      ctx.lineTo(0, height / 2);
      ctx.closePath();
      ctx.clip();
    },
    textArea: (width, height) => ({ width: width * 0.5, height: height * 0.5, offsetX: 0, offsetY: 0, fontScale: 0.8 })
  },
  triangle: {
    clipFunction: (ctx, width, height) => {
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.clip();
    },
    textArea: (width, height) => ({ width: width * 0.6, height: height * 0.4, offsetX: 0, offsetY: height * 0.15, fontScale: 0.7 })
  },
  hexagon: {
    clipFunction: (ctx, width, height) => {
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.clip();
    },
    textArea: (width, height) => {
      const size = Math.min(width, height) * 0.65;
      return { width: size, height: size, offsetX: 0, offsetY: 0, fontScale: 0.85 };
    }
  },
  star: {
    clipFunction: (ctx, width, height) => {
      const centerX = width / 2;
      const centerY = height / 2;
      const outerRadius = Math.min(width, height) / 2;
      const innerRadius = outerRadius * 0.4;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = centerX + radius * Math.cos(angle - Math.PI / 2);
        const y = centerY + radius * Math.sin(angle - Math.PI / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.clip();
    },
    textArea: (width, height) => {
      const size = Math.min(width, height) * 0.35;
      return { width: size, height: size, offsetX: 0, offsetY: 0, fontScale: 0.6 };
    }
  }
};

export const TextToImageGenerator = () => {
  const [text, setText] = useState("");
  const [imageFormat, setImageFormat] = useState<ImageFormat>('png');
  const [imageSize, setImageSize] = useState<ImageSize>('256');
  const [customSize, setCustomSize] = useState<CustomSize>({ width: 256, height: 256 });
  const [colorScheme, setColorScheme] = useState<ColorScheme>('purple');
  const [imageShape, setImageShape] = useState<ImageShape>('rounded');
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
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

      const scheme = COLOR_SCHEMES[colorScheme];
      const shapeConfig = SHAPE_OPTIONS[imageShape];
      const textAreaConfig = shapeConfig.textArea(dimensions.width, dimensions.height);

      // Apply shape clipping
      shapeConfig.clipFunction(ctx, dimensions.width, dimensions.height);

      // Create gradient background
      const gradient = ctx.createLinearGradient(0, 0, dimensions.width, dimensions.height);
      gradient.addColorStop(0, scheme.background[0]);
      gradient.addColorStop(1, scheme.background[1]);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Configure text styling with shape-specific scaling
      const baseFontSize = Math.min(dimensions.width, dimensions.height) / 10;
      const fontSize = baseFontSize * textAreaConfig.fontScale;
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = scheme.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Add text shadow for better readability
      ctx.shadowColor = scheme.text === '#ffffff' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Word wrap functionality with shape-specific max width
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      const maxWidth = textAreaConfig.width;

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

      // Draw text lines with shape-specific positioning
      const lineHeight = fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      const centerX = dimensions.width / 2 + textAreaConfig.offsetX;
      const centerY = dimensions.height / 2 + textAreaConfig.offsetY;
      const startY = centerY - totalHeight / 2 + fontSize / 2;

      lines.forEach((line, index) => {
        const y = startY + index * lineHeight;
        ctx.fillText(line, centerX, y);
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
  }, [text, imageFormat, getSizeDimensions, colorScheme, imageShape]);

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
            {/* Updated component - cache refresh */}
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

          {/* Options Section */}
          <Collapsible open={isOptionsOpen} onOpenChange={setIsOptionsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                Options
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOptionsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-4 pt-4">
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

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Color Scheme</Label>
                  <Select value={colorScheme} onValueChange={(value: ColorScheme) => setColorScheme(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purple">Purple Gradient</SelectItem>
                      <SelectItem value="blue">Blue Ocean</SelectItem>
                      <SelectItem value="green">Green Nature</SelectItem>
                      <SelectItem value="orange">Orange Sunset</SelectItem>
                      <SelectItem value="dark">Dark Mode</SelectItem>
                      <SelectItem value="light">Light & Clean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Shape</Label>
                  <Select value={imageShape} onValueChange={(value: ImageShape) => setImageShape(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rectangle">Rectangle</SelectItem>
                      <SelectItem value="rounded">Rounded Rectangle</SelectItem>
                      <SelectItem value="circle">Circle</SelectItem>
                      <SelectItem value="rhombus">Rhombus</SelectItem>
                      <SelectItem value="triangle">Triangle</SelectItem>
                      <SelectItem value="hexagon">Hexagon</SelectItem>
                      <SelectItem value="star">Star</SelectItem>
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
            </CollapsibleContent>
          </Collapsible>

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