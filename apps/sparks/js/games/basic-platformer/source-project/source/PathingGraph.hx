import TiledLevel.Tilemap;
import flixel.math.FlxPoint;

typedef HorizontalSegment =
{
	y:Int,
	start_x:Int,
	end_x:Int,
}

enum GraphLabel
{
	START;
	EXIT;
	SEGMENT(i:Int);
}

typedef Graph =
{
	label:GraphLabel,
	children:Array<Graph>,
}

class PathingGraph
{
	var tiled_level:TiledLevel;

	public var segments:Array<HorizontalSegment> = [];
	public var spikes:Array<HorizontalSegment> = [];

	var max_dist_x = 15;
	var max_dist_y = 6;

	public function new(tiled_level:TiledLevel)
	{
		makePathingGraph(tiled_level);
	}

	public function makePathingGraph(tiled_level:TiledLevel)
	{
		this.tiled_level = tiled_level;

		for (i in 0...tiled_level.tilemap_desc.tiles.length)
		{
			var t_y:Int = Math.floor(i / tiled_level.tilemap_desc.width);
			if (!tiled_level.tilemap_desc.collisions[i] // the current cell is not solid
				&& t_y < tiled_level.tilemap_desc.height - 1 // we are not on the last row
				&& tiled_level.tilemap_desc.collisions[i + tiled_level.tilemap_desc.width] // the cell below us is solid
				&& !tiled_level.isSpike(tiled_level.tilemap_desc.tiles[i + tiled_level.tilemap_desc.width])) // the cell below us is not a spike cell
			{
				var t_x = i % tiled_level.tilemap_desc.width;
				if (t_x > 0 // not first column
					&& segments.length > 0 // there is a segment in the least
					&& segments[segments.length - 1].y == t_y // the previous segment is on the same row
					&& segments[segments.length - 1].end_x == t_x - 1) // the previous segment ends at column x-1
					segments[segments.length - 1].end_x = t_x; // we add current cell to previous segment
				else
					segments.push({y: t_y, start_x: t_x, end_x: t_x}); // we create new segment
			}
		}
	}

	public function accessible(seg1:HorizontalSegment, seg2:HorizontalSegment)
	{
		var dist_1_2_x = seg2.start_x - seg1.end_x;
		var dist_1_2_y = seg1.y - seg2.y;

		if (dist_1_2_x >= 0 && dist_1_2_x <= max_dist_x && dist_1_2_y <= max_dist_y)
			return true;

		var dist_2_1_x = Math.abs(seg2.end_x - seg1.start_x);
		var dist_2_1_y = Math.abs(seg2.y - seg1.y);

		if (dist_2_1_x <= max_dist_x && dist_2_1_y <= max_dist_y)
			return true;

		return false;
	}
}
