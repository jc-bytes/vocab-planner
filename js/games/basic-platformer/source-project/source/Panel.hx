import flixel.FlxG;
import flixel.FlxSprite;
import flixel.group.FlxGroup;
import flixel.math.FlxPoint;
import flixel.text.FlxText;
import flixel.util.FlxColor;

class ControlPanel extends FlxTypedGroup<FlxText>
{
	override public function new(controls:Array<Array<String>>, offset:FlxPoint, font_size:Int, text_color:FlxColor)
	{
		super();
		var x_text:Float = 0;
		var cur_y:Float = 0;

		for (ctrl in controls)
		{
			var cmd_text = new FlxText(offset.x, offset.y + cur_y, 0, ctrl[0]);
			cmd_text.setFormat(null, font_size, text_color);
			cmd_text.scrollFactor.set(0, 0);
			add(cmd_text);
			x_text = cmd_text.width > x_text ? cmd_text.width : x_text;
			cur_y += cmd_text.height;
		}

		cur_y = 0;

		for (ctrl in controls)
		{
			var desc_text = new FlxText(offset.x + x_text, offset.y + cur_y, 0, ctrl[1]);
			desc_text.setFormat(null, font_size, text_color);
			desc_text.scrollFactor.set(0, 0);
			add(desc_text);
			cur_y += desc_text.height;
		}
	}
}

class InfoPanel extends FlxText
{
	override public function new(area_i:Int, level_i:Int)
	{
		super(0, 0, 0, 'Area $area_i - Level $level_i', 16);
		scrollFactor.set(0, 0);
		setFormat(null, 16, FlxColor.fromInt(0xFF444444));
		alignment = RIGHT;
	}
}

class EndGamePanel extends FlxTypedGroup<FlxSprite>
{
	override public function new()
	{
		super();

		var status = new FlxText(0, 0, 0, "You WON!", 32);
		status.scrollFactor.set(0, 0);
		status.borderColor = 0xff000000;
		status.alignment = CENTER;
		status.screenCenter();

		var status_bg = new FlxSprite();
		status_bg.scrollFactor.set(0, 0);
		status_bg.makeGraphic(Math.floor(status.width + 10), Math.floor(status.height + 10), FlxColor.fromRGBFloat(0, 0, 0, 0.7));
		status_bg.x = status.x - 5;
		status_bg.y = status.y - 5;

		add(status_bg);
		add(status);
	}
}
