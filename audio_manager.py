"""
Audio Manager for A.InSight Native App
Handles OpenAI TTS generation and audio playback
"""

import requests
import pygame
import tempfile
import os
from typing import Optional


class AudioManager:
    """Manages TTS audio generation and playback using OpenAI API"""
    
    def __init__(self, openai_api_key: str):
        """
        Initialize AudioManager with OpenAI API key
        
        Args:
            openai_api_key: OpenAI API key for TTS service
        """
        self.api_key = openai_api_key
        
        # Initialize pygame mixer for audio playback
        pygame.mixer.init(frequency=22050, size=-16, channels=2, buffer=512)
        
        self.current_audio_path = None
        print("🔊 AudioManager initialized")
    
    def generate_and_play_audio(self, script_text: str) -> bool:
        """
        Generate audio from text using OpenAI TTS and play it
        
        Args:
            script_text: Text to convert to speech
            
        Returns:
            True if successful, False otherwise
        """
        try:
            print(f"🎙️ Generating TTS for: {script_text[:50]}...")
            
            # 1. Generate audio via OpenAI API
            audio_data = self._generate_audio(script_text)
            if not audio_data:
                print("❌ Failed to generate audio data")
                return False
            
            # 2. Save to temporary file
            temp_path = self._save_to_temp(audio_data)
            if not temp_path:
                print("❌ Failed to save audio file")
                return False
            
            # 3. Play audio
            self._play_audio(temp_path)
            self.current_audio_path = temp_path
            
            print("✅ Audio playback started")
            return True
            
        except Exception as e:
            print(f"❌ Audio generation failed: {e}")
            return False
    
    def _generate_audio(self, text: str) -> Optional[bytes]:
        """
        Call OpenAI TTS API to generate audio
        
        Args:
            text: Text to convert to speech
            
        Returns:
            Audio data as bytes, or None if failed
        """
        url = "https://api.openai.com/v1/audio/speech"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        payload = {
            "model": "tts-1",
            "input": text,
            "voice": "onyx",  # Male voice, good for narration
            "response_format": "mp3"
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                print(f"✅ TTS API success ({len(response.content)} bytes)")
                return response.content
            else:
                print(f"❌ TTS API Error: {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                return None
                
        except requests.exceptions.Timeout:
            print("❌ TTS API timeout")
            return None
        except Exception as e:
            print(f"❌ TTS API request failed: {e}")
            return None
    
    def _save_to_temp(self, audio_data: bytes) -> Optional[str]:
        """
        Save audio data to temporary file
        
        Args:
            audio_data: Audio file data
            
        Returns:
            Path to temp file, or None if failed
        """
        try:
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
            temp_file.write(audio_data)
            temp_file.close()
            print(f"💾 Audio saved to: {temp_file.name}")
            return temp_file.name
        except Exception as e:
            print(f"❌ Failed to save temp file: {e}")
            return None
    
    def _play_audio(self, file_path: str):
        """
        Play audio file using pygame mixer
        
        Args:
            file_path: Path to audio file
        """
        try:
            pygame.mixer.music.load(file_path)
            pygame.mixer.music.play()
            print("▶️ Audio playback started")
        except Exception as e:
            print(f"❌ Playback failed: {e}")
    
    def stop(self):
        """Stop current audio playback"""
        try:
            if pygame.mixer.music.get_busy():
                pygame.mixer.music.stop()
                print("⏹️ Audio stopped")
        except Exception as e:
            print(f"⚠️ Stop failed: {e}")
    
    def is_playing(self) -> bool:
        """
        Check if audio is currently playing
        
        Returns:
            True if audio is playing, False otherwise
        """
        try:
            return pygame.mixer.music.get_busy()
        except:
            return False
    
    def cleanup(self):
        """Clean up resources and temporary files"""
        try:
            # Stop playback
            self.stop()
            
            # Remove temp file
            if self.current_audio_path and os.path.exists(self.current_audio_path):
                os.remove(self.current_audio_path)
                print(f"🗑️ Cleaned up: {self.current_audio_path}")
                self.current_audio_path = None
                
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")
