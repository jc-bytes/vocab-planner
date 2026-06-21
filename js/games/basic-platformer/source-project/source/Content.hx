import flixel.FlxG;
import flixel.system.FlxSound;

typedef Level = String;
typedef Area = Array<Level>;

class Content
{
	public static var areas:Array<Area>;

	public static var sound_damage:FlxSound;
	public static var sound_exit:FlxSound;
	public static var sound_jump:FlxSound;
	public static var sound_land:FlxSound;
	public static var sound_checkpoint:FlxSound;

	public static function load()
	{
		// area 0
		var area0 = [
			AssetPaths.Area_0_Level_0__tmx,
			AssetPaths.Area_0_Level_1__tmx,
			AssetPaths.Area_0_Level_2__tmx,
			AssetPaths.Area_0_Level_3__tmx,
			AssetPaths.Area_0_Level_4__tmx,
			AssetPaths.Area_0_Level_5__tmx,
		];

		areas = [area0];

		// SOUND
		sound_damage = FlxG.sound.load(AssetPaths.damage__wav);
		sound_exit = FlxG.sound.load(AssetPaths.exit__wav);
		sound_jump = FlxG.sound.load(AssetPaths.jump__wav);
		sound_land = FlxG.sound.load(AssetPaths.land__wav);
		sound_checkpoint = FlxG.sound.load(AssetPaths.checkpoint__wav);
	}
}
