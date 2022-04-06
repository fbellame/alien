import pygame
from pygame import sprite
import random
from os import path
from itertools import cycle

import constants
from sprites import SpaceShip, Explosion, Bullet
from levels import Level, Level1, Level2, Level3, Level4


class AlienGame():
    def __init__(self):
        
        # Initialize Pygame
        pygame.init()
        pygame.display.set_caption("(-( A L I E N )-)")
        self.laser_gun = pygame.mixer.Sound(path.join(constants.SOUND_DIR, constants.LASER_SOUND))
        self.explosion = pygame.mixer.Sound(path.join(constants.SOUND_DIR, constants.EXPLOSION_SOUND))
        pygame.mixer.music.load(path.join(constants.SOUND_DIR, constants.BACKGOUND_MUSIC))
        self.score_font = pygame.font.SysFont('freesansbold.ttf', 25)

        self.screen = pygame.display.set_mode([constants.screen_width, constants.screen_height])
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
        on_text_surface = gameover_font.render("GAME OVER - Any key to start", True, constants.YELLOW)
        
        blink_rect = on_text_surface.get_rect()
        blink_rect.center = self.screen.get_rect().center
        off_text_surface = gameover_font.render("", True, constants.YELLOW)
    
        blink_surfaces = cycle([on_text_surface, off_text_surface])
        
        background_image = pygame.image.load(path.join(constants.IMAGE_DIR,game_level.background_image)).convert()
    
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
        text = self.score_font.render("Score: " + str(self.score), True, constants.YELLOW)
 
        # set the center of the rectangular object.
        self.screen.blit(text, [10, 10])
        
        level_txt = self.score_font.render("Level: " + str(level), True, constants.YELLOW)
        
        self.screen.blit(level_txt, [720, 10])
                 
    def run_level(self, game_level: Level):
        
        #  background image
        background_image = pygame.image.load(path.join(constants.IMAGE_DIR,game_level.background_image)).convert()

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
        player.rect.x = constants.screen_width // 2
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
            if alien_bullet.rect.y < 0 or alien_bullet.rect.y > constants.screen_height:
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
levels = [Level1(1),Level2(1), Level3(1), Level4(1),Level1(2),Level2(2), 
          Level3(2), Level4(2),Level1(3),Level2(3), Level3(3), 
          Level4(3),Level1(4),Level2(4), Level3(4), Level4(4)]
while game_on:  
    for level in levels:
        win = alien_game.run_level(level)
        if not win:
            break
    alien_game.end_game(level)
    win = False