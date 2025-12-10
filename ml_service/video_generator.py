"""
Video Generator Service
Converts images to videos with typing animation for text and counting animation for numbers.
"""
import os
import base64
import io
import re
import json
from typing import Optional, Tuple, List, Dict, Any
from PIL import Image, ImageDraw, ImageFont
import numpy as np

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    import imageio
    IMAGEIO_AVAILABLE = True
except ImportError:
    IMAGEIO_AVAILABLE = False


def parse_number(text: str) -> Tuple[float, str]:
    """Parse number from text, handling currency, percentages, multipliers."""
    cleaned = text.replace('$', '').replace(',', '').strip()
    
    if '%' in text:
        value = float(re.sub(r'[^\d.]', '', cleaned))
        return value, '%'
    
    if 'x' in text.lower():
        value = float(re.sub(r'[^\d.]', '', cleaned))
        return value, 'x'
    
    value = float(re.sub(r'[^\d.]', '', cleaned))
    return value, ''


def animate_typing(text: str, progress: float) -> str:
    """Return partial text based on typing progress (0.0 to 1.0)."""
    if progress <= 0:
        return ''
    if progress >= 1.0:
        return text
    
    num_chars = int(len(text) * progress)
    return text[:num_chars]


def animate_counting(start: float, end: float, progress: float, suffix: str = '') -> str:
    """Animate number counting from start to end."""
    if progress <= 0:
        current = start
    elif progress >= 1.0:
        current = end
    else:
        # Easing function for smooth counting
        eased = progress * progress * (3.0 - 2.0 * progress)  # Smoothstep
        current = start + (end - start) * eased
    
    # Format based on suffix
    if suffix == '%':
        return f"{current:.1f}%"
    elif suffix == 'x':
        return f"{current:.2f}x"
    elif suffix == '$':
        return f"${current:.2f}"
    else:
        if current < 1:
            return f"{current:.2f}"
        elif current < 100:
            return f"{current:.2f}"
        else:
            return f"{current:.0f}"


def get_font(size: int) -> ImageFont.FreeTypeFont:
    """Get font, trying system fonts first."""
    font_paths = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/Windows/Fonts/arial.ttf",
    ]
    
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except:
                continue
    
    try:
        return ImageFont.truetype("arial.ttf", size)
    except:
        return ImageFont.load_default()


def create_animated_video(
    base_image: Image.Image,
    duration: float = 10.0,
    fps: int = 30,
    text_elements: Optional[List[Dict[str, Any]]] = None,
    number_elements: Optional[List[Dict[str, Any]]] = None
) -> bytes:
    """
    Create animated video with typing and counting animations.
    
    Args:
        base_image: Base PIL image
        duration: Video duration in seconds
        fps: Frames per second
        text_elements: List of dicts with keys: x, y, text, font_size, color
        number_elements: List of dicts with keys: x, y, start_value, end_value, suffix, font_size, color
    """
    if not IMAGEIO_AVAILABLE:
        raise ImportError("imageio is required. Install with: pip install imageio imageio-ffmpeg")
    
    frames = []
    total_frames = int(duration * fps)
    
    # Convert to RGB if needed
    if base_image.mode != 'RGB':
        base_image = base_image.convert('RGB')
    
    # Get image dimensions
    width, height = base_image.size
    
    for frame_num in range(total_frames):
        progress = frame_num / total_frames
        
        # Start with base image
        frame = base_image.copy()
        
        # Apply fade to background (non-text/number elements)
        # Fade starts at 30% progress and reaches 70% opacity by end
        fade_start = 0.3
        if progress > fade_start:
            fade_progress = (progress - fade_start) / (1.0 - fade_start)
            fade_alpha = int(255 * (1 - fade_progress * 0.3))  # Fade to 70% opacity
            overlay = Image.new('RGBA', (width, height), (0, 0, 0, 255 - fade_alpha))
            frame = Image.alpha_composite(frame.convert('RGBA'), overlay).convert('RGB')
        
        draw = ImageDraw.Draw(frame)
        
        # Animate text elements (typing effect)
        if text_elements:
            for elem in text_elements:
                text = elem.get('text', '')
                x = elem.get('x', 0)
                y = elem.get('y', 0)
                font_size = elem.get('font_size', 24)
                color = elem.get('color', (255, 255, 255))
                
                # Delay typing start slightly
                typing_start = elem.get('start_time', 0.0)
                typing_duration = elem.get('duration', 0.8)
                
                if progress < typing_start:
                    continue
                
                typing_progress = min(1.0, (progress - typing_start) / typing_duration)
                animated_text = animate_typing(text, typing_progress)
                
                font = get_font(font_size)
                draw.text((x, y), animated_text, fill=color, font=font)
        
        # Animate number elements (counting effect)
        if number_elements:
            for elem in number_elements:
                start_value = elem.get('start_value', 0)
                end_value = elem.get('end_value', 0)
                suffix = elem.get('suffix', '')
                x = elem.get('x', 0)
                y = elem.get('y', 0)
                font_size = elem.get('font_size', 24)
                color = elem.get('color', (255, 255, 255))
                
                # Delay counting start
                counting_start = elem.get('start_time', 0.2)
                counting_duration = elem.get('duration', 0.6)
                
                if progress < counting_start:
                    continue
                
                counting_progress = min(1.0, (progress - counting_start) / counting_duration)
                animated_number = animate_counting(start_value, end_value, counting_progress, suffix)
                
                font = get_font(font_size)
                draw.text((x, y), animated_number, fill=color, font=font)
        
        frames.append(np.array(frame))
    
    # Create video using imageio
    output = io.BytesIO()
    imageio.mimsave(
        output,
        frames,
        fps=fps,
        format='mp4',
        codec='libx264',
        quality=8,
        pixelformat='yuv420p'
    )
    return output.getvalue()


def generate_video_from_image(
    image_data: bytes,
    duration: float = 10.0,
    fps: int = 30,
    text_elements: Optional[List[Dict[str, Any]]] = None,
    number_elements: Optional[List[Dict[str, Any]]] = None
) -> bytes:
    """
    Main function to generate video from image.
    
    Args:
        image_data: Image bytes (PNG, JPEG, etc.)
        duration: Video duration in seconds (default 10.0)
        fps: Frames per second (default 30)
        text_elements: List of text elements to animate
        number_elements: List of number elements to animate
    
    Returns:
        Video bytes (MP4 format)
    """
    # Load image
    image = Image.open(io.BytesIO(image_data))
    
    return create_animated_video(
        image,
        duration=duration,
        fps=fps,
        text_elements=text_elements,
        number_elements=number_elements
    )


def generate_video_from_base64(
    base64_image: str,
    duration: float = 10.0,
    fps: int = 30,
    text_elements: Optional[List[Dict[str, Any]]] = None,
    number_elements: Optional[List[Dict[str, Any]]] = None
) -> bytes:
    """Generate video from base64-encoded image."""
    # Remove data URL prefix if present
    if ',' in base64_image:
        base64_image = base64_image.split(',')[1]
    
    image_data = base64.b64decode(base64_image)
    return generate_video_from_image(
        image_data,
        duration=duration,
        fps=fps,
        text_elements=text_elements,
        number_elements=number_elements
    )
