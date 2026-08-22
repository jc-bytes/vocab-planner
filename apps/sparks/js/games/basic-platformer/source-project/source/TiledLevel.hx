package;

import flixel.FlxG;
import flixel.FlxObject;
import flixel.FlxSprite;
import flixel.addons.editors.tiled.TiledImageLayer;
import flixel.addons.editors.tiled.TiledImageTile;
import flixel.addons.editors.tiled.TiledLayer.TiledLayerType;
import flixel.addons.editors.tiled.TiledMap;
import flixel.addons.editors.tiled.TiledObject;
import flixel.addons.editors.tiled.TiledObjectLayer;
import flixel.addons.editors.tiled.TiledTileLayer;
import flixel.addons.editors.tiled.TiledTilePropertySet;
import flixel.addons.editors.tiled.TiledTileSet;
import flixel.addons.tile.FlxTileSpecial;
import flixel.addons.tile.FlxTilemapExt;
import flixel.group.FlxGroup;
import flixel.math.FlxPoint;
import flixel.tile.FlxTile;
import flixel.tile.FlxTilemap;
import flixel.util.FlxColor;
import haxe.io.Path;
import openfl.display.BitmapData;

typedef Tilemap =
{
	width:Int,
	height:Int,
	tile_size:Int,
	tiles:Array<Int>,
	collisions:Array<Bool>,
	starting_pos:FlxPoint,
	exit_pos:FlxPoint,
}

typedef Tileset =
{
	data:BitmapData,
	width:Int,
	height:Int,
}

/**
 * original author Samuel Batista
 */
class TiledLevel extends TiledMap
{
	// For each "Tile Layer" in the map, you must define a "tileset" property which contains the name of a tile sheet image
	// used to draw tiles in that layer (without file extension). The image file must be located in the directory specified bellow.
	inline static var c_PATH_LEVEL_TILESHEETS = "assets/tiled/";

	// Array of tilemaps used for collision
	public var foregroundTiles:FlxGroup;
	public var objectsLayer:FlxGroup;
	public var backgroundLayer:FlxGroup;

	// public var tilemap_desc:Tilemap;
	// public var tileset:Tileset;
	var groudTileLayer:Array<FlxTilemap>;
	var destructibleTileLayer:Array<FlxTilemap>;
	var spikeTileLayer:Array<FlxTilemap>;

	var spikes_height:Int = 0;
	var spikes_bot_id:Int = -1;
	var spikes_top_id:Int = -1;
	var spikes_left_id:Int = -1;
	var spikes_right_id:Int = -1;

	public var destructible_tile_delay = 0.5;

	var destructible_id:Int;
	var destructible_timer:Float = 0;
	var to_destroy:Array<{tilemap:FlxTilemap, id:Int, time:Float}> = [];

	// Sprites of images layers
	public var imagesLayer:FlxGroup;

	public function new(tiledLevel:FlxTiledMapAsset, state:PlayState)
	{
		super(tiledLevel);

		// tilemap_desc = {
		// 	width: width,
		// 	height: height,
		// 	tile_size: tileWidth, // tileHeight == tileWidth
		// 	tiles: [for (i in 0...width * height) 0],
		// 	collisions: [for (i in 0...width * height) false],
		// 	starting_pos: new FlxPoint(),
		// 	exit_pos: new FlxPoint(),
		// };

		imagesLayer = new FlxGroup();
		foregroundTiles = new FlxGroup();
		objectsLayer = new FlxGroup();
		backgroundLayer = new FlxGroup();

		FlxG.camera.setScrollBoundsRect(0, 0, fullWidth, fullHeight, true);

		loadImages();
		loadObjects(state);

		// Load Tile Maps
		for (layer in layers)
		{
			if (layer.type != TiledLayerType.TILE)
				continue;
			var tileLayer:TiledTileLayer = cast layer;

			var tileSheetName:String = tileLayer.properties.get("tileset");

			if (tileSheetName == null)
				throw "'tileset' property not defined for the '" + tileLayer.name + "' layer. Please add the property to the layer.";

			var tileSet:TiledTileSet = null;
			for (ts in tilesets)
			{
				if (ts.name == tileSheetName)
				{
					tileSet = ts;
					break;
				}
			}

			if (tileSet == null)
				throw "Tileset '" + tileSheetName + " not found. Did you misspell the 'tilesheet' property in " + tileLayer.name + "' layer?";

			var imagePath = new Path(tileSet.imageSource);
			var processedPath = c_PATH_LEVEL_TILESHEETS + imagePath.file + "." + imagePath.ext;

			// var tileset_bmp = new FlxSprite().loadGraphic(processedPath);
			// tileset = {
			// 	data: tileset_bmp.pixels,
			// 	width: Math.floor(tileset_bmp.width / tileSet.tileWidth),
			// 	height: Math.floor(tileset_bmp.height / tileSet.tileHeight),
			// };

			// could be a regular FlxTilemap if there are no animated tiles
			var tilemap = new FlxTilemapExt();
			tilemap.loadMapFromArray(tileLayer.tileArray, width, height, processedPath, tileSet.tileWidth, tileSet.tileHeight, OFF, tileSet.firstGID, 1, 1);

			// load tilemap into desc
			// for (i in 0...tileLayer.tileArray.length)
			// 	if (tileLayer.tileArray[i] > 0)
			// 		tilemap_desc.tiles[i] = tileLayer.tileArray[i];

			if (tileLayer.properties.contains("nocollide"))
			{
				backgroundLayer.add(tilemap);
			}
			else
			{
				foregroundTiles.add(tilemap);

				// load collision data into desc
				// for (i in 0...tileLayer.tileArray.length)
				// 	if (tileLayer.tileArray[i] > 0)
				// 		tilemap_desc.collisions[i] = true;

				// WHITE tiles

				if (groudTileLayer == null)
					groudTileLayer = new Array<FlxTilemap>();
				groudTileLayer.push(tilemap);

				// BLUE tiles

				var destructible_id_str:String = tileLayer.properties.get("destructible_id");

				if (destructible_id_str == null)
					trace("'destructible_id' property not defined for the '" + tileLayer.name + "' layer. Please add the property to the layer.");
				else
				{
					destructible_id = Std.parseInt(destructible_id_str);

					if (destructibleTileLayer == null)
						destructibleTileLayer = new Array<FlxTilemap>();
					destructibleTileLayer.push(tilemap);

					tilemap.setTileProperties(destructible_id + 1, FlxObject.CEILING, function(o1, o2)
					{
						var tile:FlxTile = cast(o1, FlxTile);
						tile.tilemap.setTileByIndex(tile.mapIndex, destructible_id + 2, true);
						to_destroy.push({tilemap: tile.tilemap, id: tile.mapIndex, time: destructible_timer + destructible_tile_delay});
					}, null, 1);
				}

				// SPIKES

				var spikes_height_str:String = tileLayer.properties.get("spikes_height");

				if (spikes_height_str == null)
					trace("'spikes_height' property not defined for the '" + tileLayer.name + "' layer. Please add the property to the layer.");
				else
					spikes_height = Std.parseInt(spikes_height_str);

				var spikes_bot_id_str:String = tileLayer.properties.get("spikes_bot_id");

				if (spikes_bot_id_str == null)
					trace("'spikes_bot_id' property not defined for the '" + tileLayer.name + "' layer. Please add the property to the layer.");
				else
					spikes_bot_id = Std.parseInt(spikes_bot_id_str) + 1;

				var spikes_top_id_str:String = tileLayer.properties.get("spikes_top_id");

				if (spikes_top_id_str == null)
					trace("'spikes_top_id' property not defined for the '" + tileLayer.name + "' layer. Please add the property to the layer.");
				else
					spikes_top_id = Std.parseInt(spikes_top_id_str) + 1;

				var spikes_left_id_str:String = tileLayer.properties.get("spikes_left_id");

				if (spikes_left_id_str == null)
					trace("'spikes_left_id' property not defined for the '" + tileLayer.name + "' layer. Please add the property to the layer.");
				else
					spikes_left_id = Std.parseInt(spikes_left_id_str) + 1;

				var spikes_right_id_str:String = tileLayer.properties.get("spikes_right_id");

				if (spikes_right_id_str == null)
					trace("'spikes_right_id' property not defined for the '" + tileLayer.name + "' layer. Please add the property to the layer.");
				else
					spikes_right_id = Std.parseInt(spikes_right_id_str) + 1;
			}
		}
	}

	function getAnimatedTile(props:TiledTilePropertySet, tileset:TiledTileSet):FlxTileSpecial
	{
		var special = new FlxTileSpecial(1, false, false, 0);
		var n:Int = props.animationFrames.length;
		var offset = Std.random(n);
		special.addAnimation([
			for (i in 0...n)
				props.animationFrames[(i + offset) % n].tileID + tileset.firstGID
		], (1000 / props.animationFrames[0].duration));
		return special;
	}

	public function loadObjects(state:PlayState)
	{
		for (layer in layers)
		{
			if (layer.type != TiledLayerType.OBJECT)
				continue;
			var objectLayer:TiledObjectLayer = cast layer;

			// collection of images layer
			if (layer.name == "images")
			{
				for (o in objectLayer.objects)
				{
					loadImageObject(o);
				}
			}

			// objects layer
			if (layer.name == "objects")
			{
				for (o in objectLayer.objects)
				{
					loadObject(state, o, objectLayer, objectsLayer);
				}
			}
		}
	}

	function loadImageObject(object:TiledObject)
	{
		var tilesImageCollection:TiledTileSet = this.getTileSet("imageCollection");
		var tileImagesSource:TiledImageTile = tilesImageCollection.getImageSourceByGid(object.gid);

		// decorative sprites
		var levelsDir:String = "assets/tiled/";

		var decoSprite:FlxSprite = new FlxSprite(0, 0, levelsDir + tileImagesSource.source);
		if (decoSprite.width != object.width || decoSprite.height != object.height)
		{
			decoSprite.antialiasing = true;
			decoSprite.setGraphicSize(object.width, object.height);
		}
		if (object.flippedHorizontally)
		{
			decoSprite.flipX = true;
		}
		if (object.flippedVertically)
		{
			decoSprite.flipY = true;
		}
		decoSprite.setPosition(object.x, object.y - decoSprite.height);
		decoSprite.origin.set(0, decoSprite.height);
		if (object.angle != 0)
		{
			decoSprite.angle = object.angle;
			decoSprite.antialiasing = true;
		}

		// Custom Properties
		if (object.properties.contains("depth"))
		{
			var depth = Std.parseFloat(object.properties.get("depth"));
			decoSprite.scrollFactor.set(depth, depth);
		}

		backgroundLayer.add(decoSprite);
	}

	function loadObject(state:PlayState, o:TiledObject, g:TiledObjectLayer, group:FlxGroup)
	{
		var x:Int = o.x;
		var y:Int = o.y;

		// objects in tiled are aligned bottom-left (top-left in flixel)
		if (o.gid != -1)
			y -= g.map.getGidOwner(o.gid).tileHeight;

		switch (o.type.toLowerCase())
		{
			case "player_start":
				state.player.x = x;
				state.player.y = y;
			// tilemap_desc.starting_pos.set(Math.floor(x / tileWidth), Math.floor(y / tileHeight));

			case "checkpoint":
				var checkpoint_sprite = new FlxSprite();
				checkpoint_sprite.makeGraphic(o.width, o.height, FlxColor.fromRGBFloat(1, 1, 1, 0.2));
				checkpoint_sprite.x = x;
				checkpoint_sprite.y = y;
				state.checkpoints.add(checkpoint_sprite);

			case "exit":
				state.exit.x = x;
				state.exit.y = y;
				// tilemap_desc.exit_pos.set(Math.floor(x / tileWidth), Math.floor(y / tileHeight));
		}
	}

	public function loadImages()
	{
		for (layer in layers)
		{
			if (layer.type != TiledLayerType.IMAGE)
				continue;

			var image:TiledImageLayer = cast layer;
			var sprite = new FlxSprite(image.x, image.y, c_PATH_LEVEL_TILESHEETS + image.imagePath);
			imagesLayer.add(sprite);
		}
	}

	public function collideWithGround(obj:FlxObject):Bool
	{
		if (groudTileLayer == null)
			return false;

		for (map in groudTileLayer)
			if (map.overlapsWithCallback(obj, function(o1, o2)
			{
				var tile:FlxTile = cast(o1, FlxTile);
				if (isSpike(tile.index))
					return false;

				return FlxObject.separate(o1, o2);
			}))
				return true;

		return false;
	}

	public function collideWithSpikes(obj:FlxObject):Bool
	{
		if (groudTileLayer == null)
			return false;

		for (map in groudTileLayer)
			if (map.overlapsWithCallback(obj, function(o1, o2)
			{
				var tile:FlxTile = cast(o1, FlxTile);
				var obj:FlxSprite = cast(o2, FlxSprite);

				// we check that the character touches the spikes by taking into account its actual hitbox (width and height),
				// and we add a little 1 px bias along the secondary axis e.g. the character can stand on a left spike without dying
				// this makes it easier to drop down from boxes in this situation:
				// where C is the character going left, and < is a spike tile.
				//            _C_
				//          <|
				//           |
				//           |

				return (tile.index == spikes_bot_id && tile.y - obj.y <= spikes_height && Math.abs(obj.x - tile.x) < obj.height - 1)
					|| (tile.index == spikes_top_id
						&& obj.y + (32 - obj.height) - tile.y <= spikes_height
						&& Math.abs(obj.x - tile.x) < obj.height - 1)
					|| (tile.index == spikes_left_id
						&& obj.x + ((32 - obj.width) / 2) - tile.x <= spikes_height
						&& Math.abs(obj.y - tile.y) < obj.height - 1)
					|| (tile.index == spikes_right_id
						&& (tile.x + tile.width) - (obj.x + obj.width + ((32 - obj.width) / 2)) <= spikes_height
							&& Math.abs(obj.y - tile.y) < obj.height - 1);
			}))
				return true;

		return false;
	}

	public function update(elapsed:Float)
	{
		destructible_timer += elapsed;
		while (to_destroy.length > 0 && to_destroy[0].time <= destructible_timer)
		{
			to_destroy[0].tilemap.setTileByIndex(to_destroy[0].id, 0, true);
			to_destroy.shift();
		}
	}

	public function isSpike(id)
	{
		return id == spikes_bot_id || id == spikes_left_id || id == spikes_right_id || id == spikes_top_id;
	}
}
