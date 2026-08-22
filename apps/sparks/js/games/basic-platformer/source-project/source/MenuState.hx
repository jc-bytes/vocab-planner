package;

import flixel.FlxG;
import flixel.addons.ui.FlxUIState;

class MenuState extends FlxUIState
{
	override public function create()
	{
		FlxG.autoPause = false;
		FlxG.mouse.visible = true;
		FlxG.camera.bgColor = 0xFFFFFFFF;
		_xml_id = "menu";
		super.create();
	}

	override public function getEvent(name:String, sender:Dynamic, data:Dynamic, ?params:Array<Dynamic>)
	{
		switch (name)
		{
			case "finish_load":
			case "click_button":
				if (params != null && params.length > 2)
				{
					var area = params[1];
					var level = params[2];

					switch (Std.string(params[0]))
					{
						case "play":
							FlxG.switchState(new PlayState(area, level));
					}
				}
		}
	}
}
