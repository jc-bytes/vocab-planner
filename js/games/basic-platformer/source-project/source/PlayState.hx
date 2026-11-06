package;

import Controller.AIController;
import Controller.KeyboardController;
import Panel.ControlPanel;
import Panel.EndGamePanel;
import Panel.InfoPanel;
import flixel.FlxG;
import flixel.FlxObject;
import flixel.FlxSprite;
import flixel.FlxState;
import flixel.group.FlxGroup;
import flixel.math.FlxPoint;
import flixel.system.FlxSound;
import flixel.text.FlxText;
import flixel.tweens.FlxEase;
import flixel.tweens.FlxTween;
import flixel.util.FlxColor;
#if js
import js.Browser;
#end

class PlayState extends FlxState
{
	var area_i:Int;
	var level_i:Int;
	var checkpoint_i:Int;
	var sound:FlxSound;

	var level:TiledLevel;

	public var player:Character;
	public var exit:FlxSprite;
	public var checkpoints:FlxTypedGroup<FlxSprite>;

	var spike_height:Int = 5; // in pixels, this is used to check if there is an actual overlap with the spikes

	var add_ai = false;
	var player2:Character;
	var ai_controller:AIController;

	override public function new(area_i:Int = 0, level_i:Int = 0, checkpoint_i = -1, sound:FlxSound = null)
	{
		super();

		this.area_i = area_i;
		this.level_i = level_i;
		this.checkpoint_i = checkpoint_i;
		this.sound = sound;
	}

	override public function create()
	{
		FlxG.mouse.visible = false;
		FlxG.autoPause = false;
		FlxG.camera.bgColor = 0xFFFFFFFF;

		super.create();

		Content.load();
#if js
		var levelStarter:Dynamic = Reflect.field(Browser.window, "__basicPlatformerStartLevel");
		if (Reflect.isFunction(levelStarter))
			levelStarter(area_i, level_i, checkpoint_i);
#end

		if (sound != null)
			sound.play();

		// END CONFIG

		player = new Character(new KeyboardController(), area_i > 0 || level_i >= 5);
		FlxG.camera.follow(player);

		exit = new FlxSprite(0, 0);
		exit.makeGraphic(32, 32, 0xff00ff00);

		checkpoints = new FlxTypedGroup<FlxSprite>();

		// level = new TiledLevel(AssetPaths.second__tmx, this);
		level = new TiledLevel(Content.areas[area_i][level_i], this);
		add(level.backgroundLayer);
		add(level.imagesLayer);
		add(level.objectsLayer);
		add(level.foregroundTiles);

		if (add_ai)
		{
			var ai_controller = new AIController(level);
			player2 = new Character(ai_controller, area_i > 0 || level_i >= 5);
			player2.x = player.x;
			player2.y = player.y;
			player2.color = FlxColor.GRAY;
			player2.alpha = 0.5;
		}

		// add stuff
		add(exit);
		add(checkpoints);

		if (add_ai)
			add(player2);

		add(player);

		// TMP
		// var overlay = new FlxSprite();
		// overlay.makeGraphic(level.fullWidth, level.fullHeight, FlxColor.TRANSPARENT);
		// add(overlay);
		// for (i in 0...level.tilemap_desc.collisions.length)
		// 	if (level.tilemap_desc.collisions[i])
		// 	{
		// 		var t_x:Int = i % level.tilemap_desc.width;
		// 		var t_y:Int = Math.floor(i / level.tilemap_desc.width);
		// 		if (level.isSpike(level.tilemap_desc.tiles[i]))
		// 			FlxSpriteUtil.drawCircle(overlay, (t_x + 0.5) * level.tilemap_desc.tile_size, (t_y + 0.5) * level.tilemap_desc.tile_size, 10,
		// 				FlxColor.RED);
		// 		else
		// 			FlxSpriteUtil.drawCircle(overlay, (t_x + 0.5) * level.tilemap_desc.tile_size, (t_y + 0.5) * level.tilemap_desc.tile_size, 10,
		// 				FlxColor.GRAY);
		// 	}

		// FlxSpriteUtil.drawCircle(overlay, (level.tilemap_desc.starting_pos.x + 0.5) * level.tilemap_desc.tile_size,
		// 	(level.tilemap_desc.starting_pos.y + 0.5) * level.tilemap_desc.tile_size, 10, FlxColor.BLUE);
		// FlxSpriteUtil.drawCircle(overlay, (level.tilemap_desc.exit_pos.x + 0.5) * level.tilemap_desc.tile_size,
		// 	(level.tilemap_desc.exit_pos.y + 0.5) * level.tilemap_desc.tile_size, 10, FlxColor.GREEN);

		// var g = new PathingGraph(level);
		// for (i in 0...g.segments.length)
		// 	FlxSpriteUtil.drawLine(overlay, g.segments[i].start_x * level.tileWidth, g.segments[i].y * level.tileHeight + 16,
		// 		(g.segments[i].end_x + 1) * level.tileWidth, g.segments[i].y * level.tileHeight + 16, {
		// 		color: FlxColor.RED
		// 	});

		// UI

		var controls = [["← →", "move"], ["↑", "jump"], ["↓", "drop"], ["R", "reset"], ["Esc", "Menu"]];

		if (area_i > 0 || level_i >= 5)
		{
			controls = [
				["← →", "move"],
				["↑", "jump"],
				["↑ ↑", "double jump"],
				["↓", "drop"],
				["R", "reset"],
				["Esc", "Menu"],
			];
		}

		if (area_i == 0 && level_i == 5 && checkpoint_i == -1)
		{
			var text = new FlxText(level.tileWidth, 28 * level.tileHeight, 27 * level.tileWidth, "Unlocked: Double Jump", 48);
			text.alignment = CENTER;
			add(text);
			FlxTween.color(text, 2, FlxColor.WHITE, FlxColor.fromRGBFloat(1, 1, 1, 0), {ease: FlxEase.quintIn});
		}

		var ctrl_panel = new ControlPanel(controls, new FlxPoint(level.tileWidth * 1.5, 0), 16, FlxColor.fromInt(0xFF444444));
		add(ctrl_panel);

		var level_text = new InfoPanel(area_i, level_i);
		level_text.x = FlxG.camera.width - level.tileWidth - level_text.width;
		add(level_text);

		// CHECKPOINT

		if (checkpoint_i >= 0)
		{
			player.x = checkpoints.members[checkpoint_i].x + checkpoints.members[checkpoint_i].width / 2;
			player.y = checkpoints.members[checkpoint_i].y + checkpoints.members[checkpoint_i].height / 2;
		}

		for (i in 0...(checkpoint_i + 1))
		{
			checkpoints.members[i].active = false;
			checkpoints.members[i].visible = false;
		}
	}

	override public function update(elapsed:Float)
	{
		player.doUpdate(elapsed);

		super.update(elapsed);
		level.update(elapsed);

		// collision with white tiles
		level.collideWithGround(player);

		// collision with red spikes
		if (level.collideWithSpikes(player) || FlxG.keys.justPressed.R)
		{
#if js
			var attemptReporter:Dynamic = Reflect.field(Browser.window, "__basicPlatformerReportAttempt");
			if (Reflect.isFunction(attemptReporter))
				attemptReporter(area_i, level_i);
#end
			FlxG.switchState(new PlayState(area_i, level_i, checkpoint_i, Content.sound_damage));
		}

		if (FlxG.keys.justPressed.ESCAPE)
			FlxG.switchState(new MenuState());

		// win condition
		FlxG.overlap(exit, player, win);

		// hit checkpoint
		for (i in 0...checkpoints.length)
			if (checkpoints.members[i].active)
				if (FlxG.overlap(checkpoints.members[i], player))
					checkpoint(i);

		if (add_ai)
		{
			player2.doUpdate(elapsed);
			FlxG.overlap(exit, player2, function(_, _) player2.active = false);
			level.collideWithGround(player2);
			if (level.collideWithSpikes(player2))
				player2.active = false;
		}
	}

	public function checkpoint(i:Int)
	{
		Content.sound_checkpoint.play();
#if js
		var checkpointReporter:Dynamic = Reflect.field(Browser.window, "__basicPlatformerReportCheckpoint");
		if (Reflect.isFunction(checkpointReporter))
			checkpointReporter(i);
#end
		checkpoints.members[i].active = false;
		checkpoints.members[i].visible = false;
		checkpoint_i = i;
	}

	public function win(Exit:FlxObject, Player:FlxObject):Void
	{
#if js
		var reporter:Dynamic = Reflect.field(Browser.window, "__basicPlatformerReportScore");
		if (Reflect.isFunction(reporter))
			reporter(area_i, level_i, area_i * 6 + level_i + 1);
#end
		player.kill();

		if (level_i + 1 < Content.areas[area_i].length)
			FlxG.switchState(new PlayState(area_i, level_i + 1, -1, Content.sound_exit));
		else if (area_i + 1 < Content.areas.length)
			FlxG.switchState(new PlayState(area_i + 1, 0, -1, Content.sound_exit));
		else
		{
			var status = new EndGamePanel();
			add(status);
			Content.sound_exit.play();
		}
	}
}
