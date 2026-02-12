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
        
        # Initialize pygame mixer for audio playback with multiple channels
        pygame.mixer.init(frequency=22050, size=-16, channels=2, buffer=512)
        pygame.mixer.set_num_channels(10)  # Support up to 10 simultaneous sounds
        
        # TTS playback (using mixer.music)
        self.current_audio_path = None
        
        # Background ambience (using Sound objects on channels)
        self.ambience_sounds = []  # List of (Sound, temp_path) tuples
        self.ambience_channels = []  # List of Channel objects
        
        # Ambience sound URLs from Web version
        self.AMBIENCE_URLS = {
            "SOUND_WIND": "https://storage.googleapis.com/my-rpg-game-sounds/WINTER.mp3",
            "SOUND_WATER": "https://storage.googleapis.com/my-rpg-game-sounds/WATER.mp3",
            "SOUND_SCREAM": "https://storage.googleapis.com/my-rpg-game-sounds/SCREAM.mp3",
            "SOUND_CLANK": "https://storage.googleapis.com/my-rpg-game-sounds/CLANK.mp3",
            "SOUND_CROWD": "https://storage.googleapis.com/my-rpg-game-sounds/CROWD.mp3",
            "SOUND_QUIET": "https://storage.googleapis.com/my-rpg-game-sounds/QUIET.mp3",
            "SOUND_LOW": "https://storage.googleapis.com/my-rpg-game-sounds/LOW.mp3",
            "SOUND_HUM": "https://storage.googleapis.com/my-rpg-game-sounds/HUM.mp3",
            "SOUND_FIRE": "https://storage.googleapis.com/my-rpg-game-sounds/FIRE.mp3",
        }
        
        print("🔊 AudioManager initialized with ambience support")
    
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
        """Stop TTS narration only (keep ambience playing)"""
        try:
            if pygame.mixer.music.get_busy():
                pygame.mixer.music.stop()
                print("⏹️ TTS stopped")
        except Exception as e:
            print(f"⚠️ Stop failed: {e}")
    
    def play_ambience(self, ambience_category: str):
        """
        Play background ambience sounds based on AI-selected categories
        
        Args:
            ambience_category: Comma-separated categories (e.g., "SOUND_WIND,SOUND_WATER")
        """
        try:
            # Stop existing ambience first
            self.stop_ambience()
            
            # Parse categories
            categories = [cat.strip() for cat in ambience_category.split(',') if cat.strip()]
            if not categories:
                print("⚠️ No ambience categories specified")
                return
            
            print(f"🎵 Playing ambience: {categories}")
            
            # Download and play each ambience sound
            for i, category in enumerate(categories):
                url = self.AMBIENCE_URLS.get(category)
                if not url:
                    print(f"⚠️ Unknown ambience category: {category}")
                    continue
                
                # Download sound file
                sound_path = self._download_ambience(url, category)
                if not sound_path:
                    continue
                
                try:
                    # Load sound
                    sound = pygame.mixer.Sound(sound_path)
                    sound.set_volume(0.6)  # 60% volume for background
                    
                    # Get available channel (start from channel 1, 0 reserved for music)
                    channel = pygame.mixer.Channel(i + 1)
                    channel.play(sound, loops=-1)  # Loop forever
                    
                    # Store references
                    self.ambience_sounds.append((sound, sound_path))
                    self.ambience_channels.append(channel)
                    
                    print(f"✅ Ambience playing on channel {i + 1}: {category}")
                    
                except Exception as e:
                    print(f"❌ Failed to play {category}: {e}")
                    # Clean up failed download
                    if os.path.exists(sound_path):
                        os.remove(sound_path)
                    
        except Exception as e:
            print(f"❌ Ambience playback failed: {e}")
    
    def _download_ambience(self, url: str, category: str) -> Optional[str]:
        """
        Download ambience sound file from URL
        
        Args:
            url: URL to download from
            category: Category name for logging
            
        Returns:
            Path to downloaded file, or None if failed
        """
        try:
            print(f"⬇️ Downloading {category}...")
            response = requests.get(url, timeout=15)
            
            if response.status_code == 200:
                # Save to temp file
                temp_file = tempfile.NamedTemporaryFile(
                    delete=False, 
                    suffix=f'_{category}.mp3'
                )
                temp_file.write(response.content)
                temp_file.close()
                print(f"✅ Downloaded {category} ({len(response.content)} bytes)")
                return temp_file.name
            else:
                print(f"❌ Failed to download {category}: HTTP {response.status_code}")
                return None
                
        except requests.exceptions.Timeout:
            print(f"❌ Download timeout for {category}")
            return None
        except Exception as e:
            print(f"❌ Download error for {category}: {e}")
            return None
    
    def stop_ambience(self):
        """Stop all background ambience sounds"""
        try:
            # Stop all channels
            for channel in self.ambience_channels:
                if channel:
                    channel.stop()
            
            # Clear lists
            self.ambience_channels = []
            self.ambience_sounds = []
            
            if self.ambience_channels or self.ambience_sounds:
                print("⏹️ Ambience stopped")
                
        except Exception as e:
            print(f"⚠️ Stop ambience failed: {e}")
    
    def stop_all(self):
        """Stop both TTS narration and ambience"""
        self.stop()  # Stop TTS
        self.stop_ambience()  # Stop ambience
        print("⏹️ All audio stopped")
    
    def is_playing(self) -> bool:
        """
        Check if TTS audio is currently playing
        
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
            # Stop all playback
            self.stop_all()
            
            # Remove TTS temp file
            if self.current_audio_path and os.path.exists(self.current_audio_path):
                os.remove(self.current_audio_path)
                print(f"🗑️ Cleaned up TTS: {self.current_audio_path}")
                self.current_audio_path = None
            
            # Remove ambience temp files
            for sound, temp_path in self.ambience_sounds:
                if temp_path and os.path.exists(temp_path):
                    os.remove(temp_path)
                    print(f"🗑️ Cleaned up ambience: {temp_path}")
            
            self.ambience_sounds = []
                
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")
