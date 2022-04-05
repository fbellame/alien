import pygame
from pygame import sprite
import random
from os import path
from itertools import cycle

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
YELLOW = (255, 255, 0)
ORANGE = (255, 165, 0)

IMAGE_DIR = 'images'
SOUND_DIR = 'sounds'

SPACESHIP_IMAGE = "spaceship.png"
LASER_SOUND = "laser.wav"
EXPLOSION_SOUND = "explosion.wav"
BACKGOUND_MUSIC = "background_music.mp3"

EXPLOSITION_IMAGE = 'regularExplosion0{}.png'

MAX_ALIEN_LEVEL1 = 20
LEVEL1_IMAGE_BACKGROUND = "asteroid.png"
LEVEL1_IMAGE_ALIEN = "alien_level1.png"

MAX_ALIEN_LEVEL2 = 4
LEVEL2_IMAGE_BACKGROUND = "sun.png"
LEVEL2_IMAGE_ALIEN = "alien_level2.png"

# Set the height and width of the screen
screen_width = 800
screen_height = 600

class Alien(sprite.Sprite):
    def __init__(self, png_image):
        sprite.Sprite.__init__(self)

        # Load the image
        self.image = pygame.image.load(path.join(IMAGE_DIR,png_image)).convert()
    
        # Set our transparent color
        self.image.set_colorkey(WHITE)

        self.rect = self.image.get_rect()
        
        self.health = 100
        
        # random -1 or +1
        self.deltax = [-1,1][random.randrange(2)]
        
class Explosion(sprite.Sprite):
    def __init__(self, center, size) -> None:
        super().__init__()
        self.explosion_images = []
        for i in range(0,9):
            image_name = EXPLOSITION_IMAGE.format(i)
            img = pygame.image.load(path.join(IMAGE_DIR,image_name)).convert()
            img.set_colorkey(BLACK)
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
        self.image = pygame.image.load(path.join(IMAGE_DIR,SPACESHIP_IMAGE)).convert()
    
        # Set our transparent color
        self.image.set_colorkey(WHITE)
       
        # Set speed vector
        self.change_x = 0
        self.change_y = 0

        self.rect = self.image.get_rect()

    def changespeed(self, x, y):
        """ Change the speed of the player. """
        self.change_x += x
        self.change_y += y

    def update(self):
        self.rect.x += self.change_x

        if self.rect.x + 30 > screen_width:
            self.rect.x = screen_width - 30
        elif self.rect.x < 0:
            self.rect.x = 0

class Bullet(pygame.sprite.Sprite):
    """ This class represents the bullet . """
    def __init__(self):
        # Call the parent class (Sprite) constructor
        super().__init__()
 
        self.image = pygame.Surface([4, 10])
        self.image.fill(RED)
 
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
        self.image.fill(ORANGE)
 
        self.rect = self.image.get_rect()
 
    def update(self):
        """ Move the bullet. """
        self.rect.y += 3

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
        self.background_image = LEVEL1_IMAGE_BACKGROUND
        self.damage = 100
        self.level = 1
        
    def callback_init_alien(self, block_list, all_sprites_list):
        for i in range(MAX_ALIEN_LEVEL1):
            # This represents a block
            block = Alien(LEVEL1_IMAGE_ALIEN)
        
            # Set a random location for the block
            block.rect.x += random.randrange(screen_width - 100)
            block.rect.y = random.randrange(screen_height) - 400
        
            # Add the block to the list of objects
            block_list.add(block)
            all_sprites_list.add(block)
 
    def callback_move_alien(self, alien):
        alien.rect.y += 1
        if alien.rect.y > screen_height:
            alien.rect.y = 0

class Level2(Level):
    def __init__(self):
        self.background_image = LEVEL2_IMAGE_BACKGROUND
        self.damage = 10
        self.level = 2
        
    def callback_init_alien(self, block_list, all_sprites_list):
        positions = set()

        for i in range(MAX_ALIEN_LEVEL2):
            # This represents a block
            block = Alien(LEVEL2_IMAGE_ALIEN)
            
            random_x = random.randrange(1,6,1)
            while random_x in positions:
                random_x = random.randrange(1,6,1)
            positions.add(random_x)
            
            # Set a random location for the alien
            block.rect.x = random_x * 100
            block.rect.y = random.randrange(screen_height)  - 600

            # Add the block to the list of objects
            block_list.add(block)
            all_sprites_list.add(block)
 
    def callback_move_alien(self, alien):
        
        if alien.rect.x > screen_width or alien.rect.x < 0:
            alien.deltax = -alien.deltax
        alien.rect.x += alien.deltax

        alien.rect.y += 1
        if alien.rect.y > screen_height:
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
        self.background_image = LEVEL1_IMAGE_BACKGROUND
        self.damage = 100
        self.level = 3
        
    def callback_init_alien(self, block_list, all_sprites_list):
        for i in range(MAX_ALIEN_LEVEL1 + 5):
            # This represents a block
            block = Alien(LEVEL1_IMAGE_ALIEN)
        
            # Set a random location for the block
            block.rect.x += random.randrange(screen_width - 100)
            block.rect.y = random.randrange(screen_height)  - 600
        
            # Add the block to the list of objects
            block_list.add(block)
            all_sprites_list.add(block)
 
    def callback_move_alien(self, alien):        
        if alien.rect.x > screen_width or alien.rect.x < 0:
            alien.deltax = -alien.deltax
        alien.rect.x += alien.deltax

        alien.rect.y += 1
        if alien.rect.y > screen_height:
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

class AlienGame():
    def __init__(self):
        
        # Initialize Pygame
        pygame.init()
        pygame.display.set_caption("(-( A L I E N )-)")
        self.laser_gun = pygame.mixer.Sound(path.join(SOUND_DIR,LASER_SOUND))
        self.explosion = pygame.mixer.Sound(path.join(SOUND_DIR,EXPLOSION_SOUND))
        pygame.mixer.music.load(path.join(SOUND_DIR,BACKGOUND_MUSIC))
        self.score_font = pygame.font.SysFont('freesansbold.ttf', 25)

        self.screen = pygame.display.set_mode([screen_width, screen_height])
        self.score = 0
        
        # play background music forever in loop
        pygame.mixer.music.play(-1)

                
    def game_over(self, explosion, block_list, player, all_sprites_list):
        if pygame.sprite.spritecollide(player, block_list, True) :
            pygame.mixer.Sound.play(explosion)
            expl = Explosion(player.rect.center, 32)
            all_sprites_list.add(expl)
            return True
        return False
    
    def win_level(self, block_list):
        if len(block_list) == 0:
            return True
        
        return False

    def end_game(self, game_level):
        
        gameover_font = pygame.font.SysFont('freesansbold.ttf', 70)
        on_text_surface = gameover_font.render("GAME OVER - Any key to start", True, YELLOW)
        
        blink_rect = on_text_surface.get_rect()
        blink_rect.center = self.screen.get_rect().center
        off_text_surface = gameover_font.render("", True, YELLOW)
    
        blink_surfaces = cycle([on_text_surface, off_text_surface])
        
        background_image = pygame.image.load(path.join(IMAGE_DIR,game_level.background_image)).convert()
    
        wait = True
        while wait:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    pygame.quit()
                    quit()
                if event.type == pygame.KEYDOWN:
                    wait = False    
                    
            self.screen.blit(background_image, [0, 0])          
            self.show_score(game_level.level)
            self.screen.blit(next(blink_surfaces), blink_rect)
            pygame.display.update()
                 
            pygame.time.delay(500)
            
        self.score = 0

            
    def space_ship_bullet(self, bullet_list, alien_list, all_sprites_list, damage):
        for bullet in bullet_list:
            
            # For each alien, check if collision -> remove the bullet and alien 
            # if damage is enought and add to the score
            for block in alien_list:
                # See if bullet hit a block
                collided = pygame.sprite.collide_rect(bullet, block)

                if collided:
                    block.health -=  damage
                    pygame.mixer.Sound.play(self.explosion)
                    expl = Explosion(block.rect.center, 32)
                    all_sprites_list.add(expl)
                    bullet_list.remove(bullet)
                    all_sprites_list.remove(bullet)
                    if (block.health <= 0):
                        expl = Explosion(block.rect.center, 64)
                        all_sprites_list.add(expl)
                        alien_list.remove(block)
                        all_sprites_list.remove(block)
                    self.score += 100
    
            # Remove the bullet if it flies up off the screen
            if bullet.rect.y < -10:
                bullet_list.remove(bullet)
                all_sprites_list.remove(bullet)
       
    def show_score(self, level):
        text = self.score_font.render("Score: " + str(self.score), True, YELLOW)
 
        # set the center of the rectangular object.
        self.screen.blit(text, [10, 10])
        
        level_txt = self.score_font.render("Level: " + str(level), True, YELLOW)
        
        self.screen.blit(level_txt, [720, 10])
                 
    def run_level(self, game_level: Level):
        
        #  background image
        background_image = pygame.image.load(path.join(IMAGE_DIR,game_level.background_image)).convert()

        # This is a list of Aliens
        alien_list = pygame.sprite.Group()
        
        # This is a list of every sprite.
        # All aliens and the player block as well.
        all_sprites_list = pygame.sprite.Group()

        # List of bullets
        bullet_list = pygame.sprite.Group()
        alien_bullet_list = pygame.sprite.Group()
        
        game_level.callback_init_alien(alien_list, all_sprites_list)

        # Create a spaceship player block
        player = SpaceShip()
        player.rect.x = screen_width / 2
        player.rect.y = 570
        all_sprites_list.add(player)

        # Used to manage how fast the screen updates
        clock = pygame.time.Clock()
                
        # -------- Main Level Loop -----------
        while not self.win_level(alien_list):
            
            # --- Main event loop for player input
            self.player_move(all_sprites_list, bullet_list, player)
                        
            # Draw asteroid background the screen
            self.screen.blit(background_image, [0, 0])

            all_sprites_list.update()

            # Calculate mechanics for each bullet
            self.space_ship_bullet(bullet_list, alien_list, all_sprites_list, game_level.damage)
            self.alien_bullet_cleanup(all_sprites_list, alien_bullet_list)
                    
            # collision detection of starship and alien bullet
            if self.game_over(self.explosion, alien_bullet_list, player, all_sprites_list):
                return False

            # collision detection of starship and alien
            if self.game_over(self.explosion, alien_list, player, all_sprites_list):
                return False
                
            # Aliens move and alien bullet fire
            self.aliens_move(game_level, alien_list, all_sprites_list, alien_bullet_list)
                
            # Draw all the spites
            all_sprites_list.draw(self.screen)        

            # Limit to 60 frames per second
            clock.tick(60)
            
            # update score
            self.show_score(game_level.level)
        
            # Go ahead and update the screen with what we've drawn.
            pygame.display.flip()
            
        return True

    def aliens_move(self, game_level, alien_list, all_sprites_list, alien_bullet_list):
        # Aliens move
        for alien in alien_list:
            # fire bullet from alien sometimes
            game_level.callback_fire_alien(all_sprites_list, alien_bullet_list, alien)
                
            # move aliens
            game_level.callback_move_alien(alien)

    def alien_bullet_cleanup(self, all_sprites_list, alien_bullet_list):
        # Remove alien bullet outside screen
        for alien_bullet in alien_bullet_list:
            if alien_bullet.rect.y < 0 or alien_bullet.rect.y > screen_height:
                alien_bullet_list.remove(alien_bullet)
                all_sprites_list.remove(alien_bullet)
   
    def player_move(self, all_sprites_list, bullet_list, player):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                quit()
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_LEFT:
                    player.changespeed(-3, 0)
                elif event.key == pygame.K_RIGHT:
                    player.changespeed(3, 0)
                elif event.key == pygame.K_SPACE:
                    pygame.mixer.Sound.play(self.laser_gun)
                    # Fire a bullet if the user clicks the mouse button
                    bullet = Bullet()
                    # Set the bullet so it is where the player is
                    bullet.rect.x = player.rect.x + 25
                    bullet.rect.y = player.rect.y
                    # Add the bullet to the lists
                    all_sprites_list.add(bullet)
                    bullet_list.add(bullet)
            elif event.type == pygame.KEYUP:
                if event.key == pygame.K_LEFT:
                    player.changespeed(3, 0)
                elif event.key == pygame.K_RIGHT:
                    player.changespeed(-3, 0)
                    
#
# Main game loop
# Create the game object
alien_game = AlienGame()
            
game_on = True
win = True
levels = [Level1(),Level2(), Level2(), Level3(),Level3()]
while game_on:  
    for level in levels:
        win = alien_game.run_level(level)
        if not win:
            break
    alien_game.end_game(level)
    win = False