import pygame
from pygame import sprite
import random
from os import path
from itertools import cycle
import constants
from sprites import Alien, AlienBullet



# Base level class, sub class and implement the level
class Level():
    def __init__(self):
        self.level = 1
        
    def callback_init_alien(self, block_list, all_sprites_list):
        pass 
    
    def callback_move_alien(self, alien):
        pass
    
    def callback_fire_alien(self, all_sprites_list, alien_bullet_list, alien):
        pass
    
class Level1(Level):
    def __init__(self):
        self.background_image = constants.LEVEL1_IMAGE_BACKGROUND
        self.damage = 100
        self.level = 1
        
    def callback_init_alien(self, block_list, all_sprites_list):
        for i in range(constants.MAX_ALIEN_LEVEL1):
            # This represents a block
            block = Alien(constants.LEVEL1_IMAGE_ALIEN)
        
            # Set a random location for the block
            block.rect.x += random.randrange(constants.screen_width - 100)
            block.rect.y = random.randrange(constants.screen_height) - 400
        
            # Add the block to the list of objects
            block_list.add(block)
            all_sprites_list.add(block)
 
    def callback_move_alien(self, alien):
        alien.rect.y += 1
        if alien.rect.y > constants.screen_height:
            alien.rect.y = 0

class Level2(Level):
    def __init__(self):
        self.background_image = constants.LEVEL2_IMAGE_BACKGROUND
        self.damage = 10
        self.level = 2
        
    def callback_init_alien(self, block_list, all_sprites_list):
        positions = set()

        for i in range(constants.MAX_ALIEN_LEVEL2):
            # This represents a block
            block = Alien(constants.LEVEL2_IMAGE_ALIEN)
            
            random_x = random.randrange(1,6,1)
            while random_x in positions:
                random_x = random.randrange(1,6,1)
            positions.add(random_x)
            
            # Set a random location for the alien
            block.rect.x = random_x * 100
            block.rect.y = random.randrange(constants.screen_height)  - 600

            # Add the block to the list of objects
            block_list.add(block)
            all_sprites_list.add(block)
 
    def callback_move_alien(self, alien):
        
        if alien.rect.x > constants.screen_width or alien.rect.x < 0:
            alien.deltax = -alien.deltax
        alien.rect.x += alien.deltax

        alien.rect.y += 1
        if alien.rect.y > constants.screen_height:
            alien.rect.y = 0

    def callback_fire_alien(self, all_sprites_list, alien_bullet_list, alien):
        # fire bullet from alien sometimes
        fire_bullet = random.randrange(0, 100)
        if fire_bullet == 0:
            alien_bullet = AlienBullet()
            alien_bullet.rect.x = alien.rect.x + 25
            alien_bullet.rect.y = alien.rect.y + 50
            alien_bullet_list.add(alien_bullet)
            all_sprites_list.add(alien_bullet)
    
class Level3(Level):
    def __init__(self):
        self.background_image = constants.LEVEL1_IMAGE_BACKGROUND
        self.damage = 100
        self.level = 3
        
    def callback_init_alien(self, block_list, all_sprites_list):
        for i in range(constants.MAX_ALIEN_LEVEL1 + 5):
            # This represents a block
            block = Alien(constants.LEVEL1_IMAGE_ALIEN)
        
            # Set a random location for the block
            block.rect.x += random.randrange(constants.screen_width - 100)
            block.rect.y = random.randrange(constants.screen_height)  - 600
        
            # Add the block to the list of objects
            block_list.add(block)
            all_sprites_list.add(block)
 
    def callback_move_alien(self, alien):        
        if alien.rect.x > constants.screen_width or alien.rect.x < 0:
            alien.deltax = -alien.deltax
        alien.rect.x += alien.deltax

        alien.rect.y += 1
        if alien.rect.y > constants.screen_height:
            alien.rect.y = 0
            
    def callback_fire_alien(self, all_sprites_list, alien_bullet_list, alien):
        # fire bullet from alien sometimes
        fire_bullet = random.randrange(0, 100)
        if fire_bullet == 0:
            alien_bullet = AlienBullet()
            alien_bullet.rect.x = alien.rect.x + 25
            alien_bullet.rect.y = alien.rect.y + 50
            alien_bullet_list.add(alien_bullet)
            all_sprites_list.add(alien_bullet)
