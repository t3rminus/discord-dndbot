'use strict';
const Bluebird = require('bluebird'),
	Discord = require('discord.js'),
	DnDBeyond = require('./dndbeyond'),
	upndown = require('upndown');

const bot = new Discord.Client();
const dndClient = new DnDBeyond();
const und = new upndown();

if(!String.prototype.capitalize) {
	String.prototype.capitalize = function() {
		return this.charAt(0).toUpperCase() + this.slice(1);
	}
}

bot.on('ready', function() {
	console.log('Logged in as %s - %s\n', bot.user.username, bot.user.id);
});

bot.on('message', function(message) {
	if(message.content.indexOf('?roll')) {
		message.reply(rollCheck(message.content));
	}
	
	if(message.content.indexOf('?dndbot') === 0) {
		message.reply(
			'Commands: \n' +
			'?roll < dice descriptions >' +
			'\n\t e.g. ?roll 1d20+5, or ?roll 2d10 + 1d4' +
			'\n\n?spell < spell name or search string >' +
			'\n\t e.g. ?spell magic-missile or ?spell Find Familiar'
		);
	}
	
	if(message.content.indexOf('?spell') === 0) {
		message.channel.startTyping();
		findSpell(message.content)
			.finally(() => {
				message.channel.stopTyping();
			})
			.then(result => {
				if(result instanceof Discord.RichEmbed) {
					return message.reply({ embed: result });
				} else {
					return message.reply(result);
				}
			})
			.catch((e) => {
				console.log(e);
			})
	}
});

bot.on('error', function(err) {
	console.log(err);
});

// Start the bot!
bot.login(process.env.DISCORD_TOKEN);

function lookupSpell(message) {
	return dndClient.getSpellInfo(message)
		.then((spellInfo) => {
			if(spellInfo.components) {
				if(spellInfo.components.material && spellInfo.components.material.length) {
					spellInfo.description += '<p style="font-size:smaller;"><strong>Material Components Required.</strong> '+spellInfo.components.material.join(';')+'</p>';
				}
			}
			
			spellInfo.description = spellInfo.description.replace(/href="\//g, "href=\"https://www.dndbeyond.com/");
			
			return Bluebird.fromNode((cb) => {
					und.convert(spellInfo.description, cb)
				})
				.then((desc) => {
					spellInfo.description = desc;
					if(spellInfo.description.length > 1600) {
						while(spellInfo.description.length > 1600) {
							const lastIndex = spellInfo.description.lastIndexOf('\n\n');
							spellInfo.description = spellInfo.description.slice(0, lastIndex);
						}
						spellInfo.description += '\n\n[Read More...](https://www.dndbeyond.com/spells/'+ spellInfo.slug + ')';
					}
					return spellInfo;
				});
		})
		.then((spellInfo) => {
			const result = new Discord.RichEmbed({
				title: spellInfo.ritual ? spellInfo.name + ' (Ritual)' : spellInfo.name,
				description: spellInfo.description,
				thumbnail: {
					url: spellInfo.image,
					width: 128, height: 128
				},
				url: 'https://www.dndbeyond.com/spells/' + spellInfo.slug,
				fields: [
					{ name: "Casting Time", value: spellInfo.castingTime, inline: true },
					{ name: "Duration", value: spellInfo.duration, inline: true },
					{ name: "Range/Area", value: spellInfo.rangeArea, inline: true },
					
					{ name: "Components", value: spellInfo.stringComponents, inline: true },
					{ name: "Attack/Save", value: spellInfo.attackSave, inline: true },
					{ name: "Damage/Effect", value: spellInfo.damageEffect, inline: true },
					
					{ name: "Level", value: spellInfo.level, inline: true },
					{ name: "Classes", value: spellInfo.classes.join('\n'), inline: true },
					{ name: "School of Magic", value: spellInfo.school.capitalize(), inline: true },
				],
				footer: {
					icon_url: 'https://media-waterdeep.cursecdn.com/avatars/thumbnails/0/7/32/32/636234383738246053.png',
					text: "\u00A9 Wizards, Inc. / D&D Beyond"
				}
			});
			
			return result;
		});
}

function findSpell(message) {
	const search = message.replace(/\s*\?spell\s*/, '').trim();
	return dndClient.findSpell(search)
		.then((results) => {
			if(!results.length) {
				return lookupSpell(search)
					.catch(() => {
						return 'Search Results:\n\tNo spells found.'
					});
			}
			if(results.length === 1) {
				return lookupSpell(results[0].slug);
			}
			
			return 'Search Results:\n\t' + results.map(spell => spell.name + ': ?spell ' + spell.slug).join('\n\t');
		})
		.catch((err) => {
			console.log('Error on ?spell lookup', message);
			console.log(err);
			return 'An unknown error occurred while processing your query';
		});
}

function rollCheck(message) {
	if(/^\?roll /.test(message)) {
		const dice = [];
		let error = false;
		
		let tmpDice, tmpAdd;
		const dicePattern = /([0-9]+)d([0-9]+)/g;
		const addPattern = /\s?([+-])\s?([0-9]+)/g;
		while (tmpDice = dicePattern.exec(message)) {
			if(tmpDice[1] && tmpDice[2] && parseInt(tmpDice[1]) && parseInt(tmpDice[2])) {
				const die = {
					count: parseInt(tmpDice[1]),
					max: parseInt(tmpDice[2]),
					add: null
				};
				
				if(die.count > 1000 || die.max < 0 || die.max > 10000) {
					error = true;
					break;
				}
				
				let additions = message.substr(tmpDice.index + tmpDice[0].length).split(dicePattern);
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
		
		let resultMessage = '', roll;
		if(!error) {
			let finalTotal = 0, finalAdditions = null;
			dice.forEach(function(die) {
				if(resultMessage !== '') {
					resultMessage += '\n';
				}
				
				die.results = [];
				die.total = 0;
				for(let i = 0; i < die.count; i++) {
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
				if(dice[0].add) {
					resultMessage += '\n  '+dice[0].total+' with ' + ((dice[0].add > 0) ? '+' : '-') + Math.abs(dice[0].add) + ' = ' + (dice[0].total + dice[0].add);
				}
			}
			if(dice.length === 1 && dice[0].count === 1 && dice[0].total === 1) {
				resultMessage = 'Rolled 1d'+dice[0].max+': 1 ...critical failure :confounded:';
				if(dice[0].add) {
					resultMessage += '\n  '+dice[0].total+' with ' + ((dice[0].add > 0) ? '+' : '-') + Math.abs(dice[0].add) + ' = ' + (dice[0].total + dice[0].add);
				}
			}
			return resultMessage;
		} else {
			return 'Whoops! I didnt\'t understand that roll.';
		}
	}
}