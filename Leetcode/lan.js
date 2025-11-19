//math/noise
//  rng, reseedNoise, noise2, fbm, clamp
//world/biomes
//  parameters, shape, weightsAtCell, biomeMix
//world/heightfield
//  heightfieldSample(x,z,seed)
//world/chunks
//  class chunk, class chunkmanager
//world/flora
//  class FloraManager
//world/data
//  const biomes, cosmeticFlora, interactableFlora, items
//world/Player-World
//  function collectInteractable, wildSpawnfield, chunkUpdater
//
//entities/data
//  const species, composites, movesets, itemEffects
//entities/Player-Roster
//  class RosterSystem, class CreatureStorage
//  function mapCommandsToIntent, collectWildCreature
//  function useItem
//entities/Entity
//  class Creature, (defacto extensions: Wild, Roster, Boss)
//  class Effects, class Cooldowns
//entities/Brain
//  class Bot
//entities/progression
//  class LevelSystem, class MorphSystem
//entities/WorldEntities
//  class Projectile, class AreaEffects
//combat/data
//  const moveCategories, abilities,
//combat/mediate
//  class CombatManager, class AbilityTranslater

//services/world
// class World{
//   for each player: {
//    (client to server)process player keys and options
//    (InventoryService)process inventory requests
//    (Roster/StorageService)process player roster/storage requests
//    (map intent) overwrite bot intent if creature in manual
//    (Player-World) send position data to ChunkService & Interactables & spawnfield
//  }
//  for each entity{                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        
//   (BrainService) automatically fill intent in auto mode
//   (EntityService) Request intents (move) then (ability)
//   (TimeService).Cooldowns: check cooldowns to vaidate
//   (CombatService) Translate ability definitions:
//   if melee, translate damage, if projectile, use new Projectile()
//   if AreaEffect, use new AreaEffect() and also process special arguments
//   (TimeService).Effects: Non-oneshot effects time logic
//  }
//  for each worldEntity{
//   tick
//  }
//  send data to clients
//
//}

//instance creations:
//Player => new Inventory(), Roster(), CreatureStorage(),
//function starterEntity & player => "roster" Creature
//World => Chunks => Flora, Terrain, Interactables
//Interactables & Flora => Items (Inventory)
//Items => Effect (Entity)
//World => Spawnfield => "wild" Creature
//moveset definition into Creature
//AbilityTranslater & moveset definition into CombatService
//if !movetype = melee:
//World.CombatService() & Creature abilities => new Projectile(), new AreaEffect
//function captureWild & "wild" Creature => "roster" Creature
