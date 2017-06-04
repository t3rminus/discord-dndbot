var Discord = require('discord.io');

var bot = new Discord.Client({
	token: process.env.DISCORD_TOKEN,
	autorun: true
});

bot.on('ready', function() {
	console.log('Logged in as %s - %s\n', bot.username, bot.id);
});

bot.on('message', function(user, userID, channelID, message, event) {
	if(/^\?roll /.test(message)) {
		var message = rollCheck(message);
		bot.sendMessage({
			to: channelID,
			message: message
		});
	}
	if(message.indexOf('?dndbot') === 0) {
		bot.sendMessage({
			to: channelID,
			message: 'Commands: \n' +
				'?roll < dice descriptions >' +
				'\n\t e.g. 1d20+5, or 2d10 + 1d4'
		});
	}
});

function rollCheck(message) {
	if(/^\?roll /.test(message)) {
		var dice = [];
		var error = false;
		
		var tmpDice, tmpAdd;
		var dicePattern = /([0-9]+)d([0-9]+)/g;
		var addPattern = /\s?([+-])\s?([0-9]+)/g;
		while (tmpDice = dicePattern.exec(message)) {
			if(tmpDice[1] && tmpDice[2] && parseInt(tmpDice[1]) && parseInt(tmpDice[2])) {
				var die = {
					count: parseInt(tmpDice[1]),
					max: parseInt(tmpDice[2]),
					add: null
				};
				
				if(die.count > 1000 || die.max < 0 || die.max > 10000) {
					error = true;
					break;
				}
				
				var additions = message.substr(tmpDice.index + tmpDice[0].length).split(dicePattern);
				if(additions[0] && additions[0].length) {
					additions = additions[0];
					while (tmpAdd = addPattern.exec(additions)) {
						if(parseInt(tmpAdd[1] + tmpAdd[2])) {
							if(die.add === null) {
								die.add = 0;
							}
							die.add += parseInt(tmpAdd[1] + tmpAdd[2]);
						}
					}
				}
				dice.push(die);
			} else {
				error = true;
				break;
			}
		}
		
		var resultMessage = '', roll;
		if(!error) {
			var finalTotal = 0, finalAdditions = null;
			dice.forEach(function(die) {
				if(resultMessage !== '') {
					resultMessage += '\n';
				}
				
				die.results = [];
				die.total = 0;
				for(var i = 0; i < die.count; i++) {
					roll = Math.floor((Math.random() * die.max) + 1);
					die.results.push(roll);
					die.total += roll;
					finalTotal += roll;
				}
				
				resultMessage += 'Rolled ' + die.count + 'd' + die.max
					+ ': ' + die.results.join(', ');
				if(die.add !== null) {
					resultMessage += ' (with ' + ((die.add > 0) ? '+' : '-') + Math.abs(die.add) + ')';
					resultMessage += ' = ' + (die.add + die.total);
					if(finalAdditions === null) {
						finalAdditions = 0;
					}
					finalAdditions += die.add;
				} else if(die.count > 1) {
					resultMessage += ' = ' + die.total;
				}
			});
			if(dice.length > 1) {
				resultMessage += '\n';
				if(finalAdditions !== null) {
					resultMessage += 'Final total: ' + (finalTotal + finalAdditions)
						+ ' (' + finalTotal + ' without modifiers)';
				} else {
					resultMessage += 'Final total: ' + finalTotal;
				}
			}
			if(dice.length === 1 && dice[0].count === 1 && dice[0].total === dice[0].max) {
				resultMessage = 'Rolled 1d'+dice[0].max+': '+dice[0].total+'! CRITICAL HIT! :tada: :confetti_ball:';
				resultMessage += '\n  '+dice[0].total+' with ' + ((die.add > 0) ? '+' : '-') + Math.abs(die.add) + ' = ' + (dice[0].total + dice[0].add);
			}
			if(dice.length === 1 && dice[0].count === 1 && dice[0].total === 1) {
				resultMessage = 'Rolled 1d'+dice[0].max+': 1 ...critical failure :confounded:';
				resultMessage += '\n  '+dice[0].total+' with ' + ((die.add > 0) ? '+' : '-') + Math.abs(die.add) + ' = ' + (dice[0].total + dice[0].add);
			}
			return resultMessage;
		} else {
			return 'Whoops! I didnt\'t understand that roll.';
		}
	}
}