import Controller.Control;
import Controller.KeyboardController;
import flixel.FlxG;
import flixel.FlxObject;
import flixel.FlxSprite;
import flixel.addons.effects.chainable.FlxShakeEffect;
import flixel.tweens.FlxEase;
import flixel.tweens.FlxTween;

class Character extends FlxSprite
{
	var controller:Controller;
	var control:Control = {
		left: false,
		right: false,
		jump: false,
		down: false,
	};

	public var double_jump_unlocked = false;

	var max_velocity_y = 600;
	var jump_velocity:Float;

	var ground_acceleration:Float;
	var air_acceleration:Float;

	var air_drag:Float;
	var stoping_drag:Float;
	var turning_drag:Float;
	var wall_drag:Float;

	var state_machine:StateMachine;

	var pre_down:Bool = false;

	override public function new(controller:Controller, double_jump_unlocked = false)
	{
		super();

		this.controller = controller;
		controller.bind(this);

		this.double_jump_unlocked = double_jump_unlocked;

		state_machine = new StateMachine(this);

		loadGraphic(AssetPaths.character__png, true, 32, 32);
		animation.add("stand", [0, 1], 2, true);
		animation.add("jump", [5, 6, 7, 8, 9], 10, false);
		animation.add("land", [6, 5], 10, false);
		animation.add("grab_left", [10], 2, true);
		animation.add("grab_right", [10], 2, true, true, false);
		animation.add("unstick_left", [10, 11, 12, 13], 12, true);
		animation.add("unstick_right", [10, 11, 12, 13], 12, true, true, false);
		animation.play("stand");

		height = 28;
		width = 28;
		offset.set(2, 4);

		scale.set(0, 0);
		FlxTween.tween(this, {"scale.x": 1, "scale.y": 1}, 0.5, {ease: FlxEase.quadOut, type: ONESHOT});

		// CONFIG

		maxVelocity.x = 600;
		maxVelocity.y = max_velocity_y;
		jump_velocity = 500;

		ground_acceleration = maxVelocity.x * 4;
		air_acceleration = maxVelocity.x * 2;

		air_drag = maxVelocity.x;
		stoping_drag = maxVelocity.x * 10;
		turning_drag = maxVelocity.x * 50;
		wall_drag = maxVelocity.y * 5000;
	}

	public function doUpdate(elapsed:Float)
	{
		controller.get(control);

		acceleration.x = 0;
		acceleration.y = 2000; // gravity
		maxVelocity.y = max_velocity_y;

		state_machine.update(elapsed, control);

		switch (state_machine.state)
		{
			case WALL(_):
				// VERTICAL movement only
				if (control.down)
				{
					maxVelocity.y = max_velocity_y;
					acceleration.y -= 300;
				}
				else
				{
					maxVelocity.y = max_velocity_y / 10;
					acceleration.y -= 1000;
				}
				if (velocity.y < 0)
					velocity.y = 0;
			case GROUND:
				// HORIZONTAL movement only (if jump the state will switch to air)
				drag.x = stoping_drag; // we can set this at every frame because it's only taken into account when acceleration is 0

				if (control.left)
				{
					if (velocity.x > 0)
						drag.x = turning_drag;
					acceleration.x -= ground_acceleration;
				}
				if (control.right)
				{
					if (velocity.x < 0)
						drag.x = turning_drag;
					acceleration.x += ground_acceleration;
				}
			case AIR(_):
				drag.x = air_drag;

				if (control.left)
					acceleration.x -= air_acceleration;
				if (control.right)
					acceleration.x += air_acceleration;
			case DROP(_):
				acceleration.x = 0;
				velocity.x = 0;
				velocity.y = maxVelocity.y * 10;
		}
	}

	public function jump(elapsed:Float, wall:Bool = false, wall_left:Bool = false)
	{
		if (wall)
		{
			if (wall_left)
				velocity.x += Math.sqrt(2) * jump_velocity;
			else
				velocity.x -= Math.sqrt(2) * jump_velocity;
			velocity.y -= Math.sqrt(2) * jump_velocity;
			animation.play("stand");
		}
		else
		{
			velocity.y -= jump_velocity; // after initial impulse, always jump up
			animation.play("jump");
		}
		Content.sound_jump.play();
	}

	public function continue_jump(elapsed:Float)
		velocity.y -= jump_velocity;

	public function land(shake:Bool = false)
	{
		animation.play("land");
		Content.sound_land.play();
		if (shake)
			FlxG.camera.shake(0.001, 0.2);
	}

	public function stand()
	{
		animation.play("stand");
	}
}

enum MachineState
{
	GROUND;
	AIR(n_jumps:Int, from_wall:Bool);
	WALL(left:Bool);
	DROP(n_jumps:Int);
}

class StateMachine
{
	var character:Character;

	// PARAMETERS
	var max_n_jumps:Int = 2;
	var hold_jump_delay:Float = 0.1;
	var jump_buffer_delay:Float = 0.2;
	var ground_ledge_assist_delay:Float = 0.05;
	var wall_ledge_assist_delay:Float = 0.2;
	var touching_wall_delay:Float = 0.2;
	var stick_wall_delay:Float = 0.2;

	// ---- END PARAMETERS
	var memory = {
		// timers
		hold_jump_timer: -1.0,
		jump_buffer_timer: -1.0,
		ledge_assist_timer: -1.0,
		touching_wall_timer: -1.0,
		stick_wall_timer: -1.0,
		//
		init: true,
		last_state: AIR(1, false),
		did_jump: false,
		pre_jump: false,
		ledge_assist_wall_left: false,
	};

	public var state(default, null):MachineState;
	public var init(get, never):Bool;
	public var did_jump(get, never):Bool;
	public var last_state(get, never):MachineState;

	public function new(character:Character)
	{
		this.character = character;
		memory.last_state = AIR(1, false);
		state = AIR(1, false);

		if (character.double_jump_unlocked)
			max_n_jumps = 2;
		else
			max_n_jumps = 1;
	}

	public function get_init()
		return memory.init;

	public function get_did_jump()
		return memory.did_jump;

	public function get_last_state()
		return memory.last_state;

	/*
	 * automaton:
	 * 	- states: GROUND, AIR(n_jumps), WALL, DROP
	 * 	- transitions:
	 * 		- falling: GROUND -> AIR(0)
	 * 			ledge_assist_timer > ground_ledge_assist delay
	 * 			/ reset ledge_assist_timer
	 * 		- jump: GROUND -> AIR(0)
	 * 			justpressed jump key
	 * 		- double_jump: AIR(n) -> AIR(n+1)
	 * 			justpressed jump key
	 * 		and n+1 < max_n_jumps
	 * 		- wall_ledge_assist: AIR(n) -> AIR(0)
	 * 			touching_wall
	 * 		and ledge_assist_timer <= wall_ledge_assist
	 * 		and wall_ledge_assist
	 * 		- buffered_jump (ground): AIR(n) -> AIR(0)
	 * 			touching_ground
	 * 		and jump_buffer_timer >= 0 && jump_buffer_timer <= jump_buffer_delay
	 * 			/ reset jump_buffer_timer
	 * 		- buffered_jump (wall): AIR(n) -> AIR(0)
	 * 			touching_wall
	 * 		and jump_buffer_timer >= 0 && jump_buffer_timer <= jump_buffer_delay
	 * 			/ reset jump_buffer_timer
	 * 		- land: AIR(n) -> GROUND
	 * 			touching_ground
	 * 		- stick: AIR(n) -> WALL
	 * 			touching_wall && ledge_assist_timer > wall_ledge_assist_delay
	 * 			/ reset stick_wall_timer
	 * 		- drop: AIR(n) -> DROP
	 * 			justpressed down key
	 * 		- unstick: WALL -> AIR(0)
	 * 			justpressed jump key
	 * 		 or stick_wall_timer > stick_wall_delay
	 * 		- land_from_wall: WALL -> GROUND
	 * 			touching_ground
	 * 		- land: DROP -> GROUND
	 * 			touching_ground
	 */
	public function update(elapsed:Float, control:Control)
	{
		// READ MEMORY

		var just_jumped = control.jump && !memory.pre_jump;
		var touching_ground = character.isTouching(FlxObject.FLOOR);
		var touching_wall_left = character.isTouching(FlxObject.LEFT);
		var touching_wall = touching_wall_left || character.isTouching(FlxObject.RIGHT);
		var did_jump = false;

		// UPDATE STATE
		switch (state)
		{
			case GROUND:
				if (memory.init)
				{
					memory.ledge_assist_timer = -1;

					switch (memory.last_state)
					{
						case AIR(_):
							character.land();
						case WALL(_):
							character.stand();
						case DROP(_):
							character.land(true);
						default:
					}

					memory.init = false;
				}

				if (character.animation.finished)
					character.stand();

				if (just_jumped) // jump
				{
					character.jump(elapsed);
					did_jump = true;
					switchState(AIR(0, false));
				}
				else if (!touching_ground && memory.ledge_assist_timer < 0) // falling
					memory.ledge_assist_timer = 0;
				else if (touching_ground && memory.ledge_assist_timer >= 0) // need to reset timer
					memory.ledge_assist_timer = -1;
				else if (memory.ledge_assist_timer > ground_ledge_assist_delay) // fall
					switchState(AIR(0, false));
			case AIR(n, from_wall):
				// in this state, ledge assist will be used to
				// remember last time a wall was touched to trigger
				// a wall jump even if the player hit the key a bit
				// too late

				if (memory.init)
				{
					memory.hold_jump_timer = 0;
					memory.jump_buffer_timer = -1;
					memory.touching_wall_timer = -1;
					memory.ledge_assist_timer = -1;

					if (!memory.did_jump)
						character.stand();

					memory.init = false;
				}

				if (!touching_wall)
					memory.touching_wall_timer = -1;

				if (!control.jump)
					memory.hold_jump_timer = -1;

				if (just_jumped && memory.ledge_assist_timer >= 0 && memory.ledge_assist_timer <= wall_ledge_assist_delay)
				{
					character.jump(elapsed, true, memory.ledge_assist_wall_left);
					switchState(AIR(0, true));
					did_jump = true;
				}
				else if (just_jumped && n + 1 < max_n_jumps) // double jump
				{
					character.jump(elapsed);
					switchState(AIR(n + 1, from_wall));
					did_jump = true;
				}
				else if (!just_jumped
					&& memory.hold_jump_timer >= 0
					&& memory.hold_jump_timer <= hold_jump_delay) // holding jump key makes you go higher
					character.continue_jump(elapsed);
				else if (touching_ground
					&& memory.jump_buffer_timer >= 0
					&& memory.jump_buffer_timer <= jump_buffer_delay) // apply buffered jump
				{
					character.jump(elapsed);
					did_jump = true;
					switchState(AIR(0, false));
				}
				else if (touching_wall
					&& memory.jump_buffer_timer >= 0
					&& memory.jump_buffer_timer <= jump_buffer_delay) // apply buffered jump
				{
					character.jump(elapsed, true, touching_wall_left);
					did_jump = true;
					switchState(AIR(0, true));
				}
				else if (control.down)
					switchState(DROP(n));
				else if (touching_ground)
					switchState(GROUND);
				else if (touching_wall)
				{
					memory.ledge_assist_timer = 0;
					memory.ledge_assist_wall_left = touching_wall_left;

					// if we're not coming from another wall,
					// we start counting time to stick eventually
					if (!from_wall && memory.touching_wall_timer < 0)
						memory.touching_wall_timer = 0;

					// if we come from wall, or if the timer has reached its horizon,
					// we stick !
					if (from_wall || memory.touching_wall_timer > touching_wall_delay)
					{
						switchState(WALL(touching_wall_left));
						// UGLY BUT NECESSARY ??
						// if no x movement, horizontal collisions are not set
						// so we add x acceleration to make the character
						// collide with the wall and set isTouching to LEFT or RIGHT
						if (touching_wall_left)
							character.acceleration.x -= 1;
						else
							character.acceleration.x += 1;
					}
				}

				if (just_jumped && !did_jump) // pressed jump key but didn't jump, buffer it
					memory.jump_buffer_timer = 0;

			case WALL(left):
				if (memory.init)
				{
					if (left)
						character.animation.play("grab_left");
					else
						character.animation.play("grab_right");
					memory.init = false;
				}

				// UGLY BUT NECESSARY ??
				// if no x movement, horizontal collisions are not set
				// so we add x acceleration to make the character
				// collide with the wall and set isTouching to LEFT or RIGHT
				if (left)
					character.acceleration.x -= 1;
				else
					character.acceleration.x += 1;

				if (left && !control.right || !left && !control.left) // released arrow key too soon to unstick
				{
					memory.stick_wall_timer = -1;
					if (left)
						character.animation.play("grab_left");
					else
						character.animation.play("grab_right");
				}

				if (just_jumped)
				{
					character.jump(elapsed, true, left);
					did_jump = true;
					switchState(AIR(0, true));
				}
				else if (left
					&& !character.isTouching(FlxObject.LEFT)
					|| !left
					&& !character.isTouching(FlxObject.RIGHT)) // there's no wall anymore
					switchState(AIR(0, true));
				else if ((left && control.right || !left && control.left)
					&& memory.stick_wall_timer < 0) // if character stuck and horizontal movement asked
				{
					memory.stick_wall_timer = 0;
					if (left)
						character.animation.play("unstick_left");
					else
						character.animation.play("unstick_right");
				}
				else if (memory.stick_wall_timer > stick_wall_delay) // unstick from wall if pressed arrow key long enough
					switchState(AIR(0, true));
				else if (touching_ground)
					switchState(GROUND);

			case DROP(n):
				if (memory.init)
					memory.init = false;

				if (!control.down)
					switchState(AIR(n, false));
				else if (character.isTouching(FlxObject.FLOOR))
					switchState(GROUND);
		}

		// UPDATE MEMORY

		memory.did_jump = did_jump;
		memory.pre_jump = control.jump;

		if (memory.hold_jump_timer >= 0)
			memory.hold_jump_timer += elapsed;

		if (memory.jump_buffer_timer >= 0)
			memory.jump_buffer_timer += elapsed;

		if (memory.ledge_assist_timer >= 0)
			memory.ledge_assist_timer += elapsed;

		if (memory.touching_wall_timer >= 0)
			memory.touching_wall_timer += elapsed;

		if (memory.stick_wall_timer >= 0)
			memory.stick_wall_timer += elapsed;
	}

	function switchState(new_state:MachineState)
	{
		memory.last_state = state;
		state = new_state;
		memory.init = true;
	}
}
