import pygame
from pygame import sprite
import random
from os import path
from itertools import cycle
import constants


class Alien(sprite.Sprite):
    def __init__(self, image_dict):
        sprite.Sprite.__init__(self)

        # Load the image of full health
        self.health = 100
        self.images = image_dict
        self.image = self.images[self.health]
    
        # Set our transparent color
        self.image.set_colorkey(constants.WHITE)

        self.rect = self.image.get_rect()
        
        # random -1 or +1
        self.deltax = [-1,1][random.randrange(2)]
        
    def update(self): 
        
        # update image to reflect health
        self.image = self.images[self.health]

        
class Explosion(sprite.Sprite):
    def __init__(self, center, size) -> None:
        super().__init__()
        self.explosion_images = []
        for i in range(0,9):
            image_name = constants.EXPLOSITION_IMAGE.format(i)
            img = pygame.image.load(path.join(constants.IMAGE_DIR,image_name)).convert()
            img.set_colorkey(constants.BLACK)
            img_small = pygame.transform.scale(img, [size, size])
            self.explosion_images.append(img_small)
        
        self.frame = 0    
        self.image = self.explosion_images[self.frame]
        self.rect = self.image.get_rect()
        self.rect.center = center
        self.frame_rate = 50
        self.last_update = pygame.time.get_ticks()
        
    def update(self): 
        now = pygame.time.get_ticks()
        if now - self.last_update > self.frame_rate:
            self.last_update = now
            self.frame += 1
            if self.frame == len(self.explosion_images):
                self.kill()
            else:
                center = self.rect.center
                self.image = self.explosion_images[self.frame]
                self.rect = self.image.get_rect()
                self.rect.center = center
                
class SpaceShip(sprite.Sprite):
    def __init__(self):
        sprite.Sprite.__init__(self)
    
        # Load the image
        self.image = pygame.image.load(path.join(constants.IMAGE_DIR,constants.SPACESHIP_IMAGE)).convert_alpha()
    
        # Set our transparent color
        self.image.set_colorkey(constants.WHITE)
       
        # Set speed vector
        self.change_x = 0
        self.change_y = 0

        self.rect = self.image.get_rect()

    def changespeed(self, x, y):
        """ Change the speed of the player. """
        if abs(self.change_x + x) > constants.MAX_SPEED:
            self.change_x = 0    
        self.change_x += x
        self.change_y += y
        

    def update(self):
        self.rect.x += self.change_x

        if self.rect.x + 30 > constants.screen_width:
            self.rect.x = constants.screen_width - 30
        elif self.rect.x < 0:
            self.rect.x = 0

class Bullet(pygame.sprite.Sprite):
    """ This class represents the bullet . """
    def __init__(self):
        # Call the parent class (Sprite) constructor
        super().__init__()
 
        self.image = pygame.Surface([4, 10])
        self.image.fill(constants.RED)
 
        self.rect = self.image.get_rect()
 
    def update(self):
        """ Move the bullet. """
        self.rect.y -= 3
        
class AlienBullet(pygame.sprite.Sprite):
    """ This class represents the bullet . """
    def __init__(self):
        # Call the parent class (Sprite) constructor
        super().__init__()
 
        self.image = pygame.Surface([4, 10])
        self.image.fill(constants.ORANGE)
 
        self.rect = self.image.get_rect()
 
    def update(self):
        """ Move the bullet. """
        self.rect.y += 3
