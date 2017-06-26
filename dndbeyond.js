'use strict';
const Bluebird = require('bluebird'),
	web = require('request-promise'),
	cheerio = require('cheerio');

const IMG_URL = 'static-waterdeep.cursecdn.com/1-0-6385-24876/Skins/Waterdeep/images/sprites/schools.png';
const IMG_SCHOOLS = ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation'];
const IMG_SCHOOL_SIZE = 128;

const DnDBeyond = module.exports = function DnDBeyond() {};

DnDBeyond.prototype._getStatBlock = function DnDBeyond__getStatBlock($, cl) {
	return $('.ddb-statblock-item-'+cl+' .ddb-statblock-item-value').text().trim();
};

DnDBeyond.prototype.getSpellIcon = function DnDBeyond_getSpellIcon(school) {
	if(IMG_SCHOOLS.indexOf(school) === -1) {
		return Bluebird.reject('Invalid school');
	}
	
	return Bluebird.resolve('http://static-waterdeep.cursecdn.com.rsz.io/1-0-6385-24876/Skins/Waterdeep/images/sprites/schools.png?mode=crop&width='+IMG_SCHOOL_SIZE+'&height='+IMG_SCHOOL_SIZE+'&crop-hint-x='+(64 + (IMG_SCHOOLS.indexOf(school) * IMG_SCHOOL_SIZE)));
	/*return Bluebird.resolve('https://static-waterdeep.cursecdn.com/1-0-6385-24876/Skins/Waterdeep/images/sprites/schools.png');
	return Bluebird.resolve('http://images.weserv.nl?url='+IMG_URL+'&crop='+IMG_SCHOOL_SIZE+','+IMG_SCHOOL_SIZE+','+IMG_SCHOOLS.indexOf(school) * IMG_SCHOOL_SIZE+',0'); */
};

DnDBeyond.prototype.getSpellInfo = function DnDBeyond_getSpellInfo(spell) {
	return web.get('https://www.dndbeyond.com/spells/'+spell)
		.then((html) => {
			const $ = cheerio.load(html);
			
			const componentsBlurb = $('.more-info-content .components-blurb');
			let components = componentsBlurb.html();
			componentsBlurb.remove();
			
			const $aoeSize = $('.ddb-statblock-item-range-area .ddb-statblock-item-value .aoe-size');
			$aoeSize.remove();
			let range = $('.ddb-statblock-item-range-area .ddb-statblock-item-value').text().trim();
			if($aoeSize.length) {
				const type = $aoeSize.find('i').attr('class').replace(/^i-aoe-/,'');
				const aoeRange = $aoeSize.text()
					.trim()
					.replace(/^\(\s*/g,'')
					.replace(/\s+\*?\s*\)$/g, '')
					.trim();
				range = range + ' / ' + aoeRange + ' ' + type;
			}
			
			let ritual = false;
			if($('.spell-name .i-ritual').length > 0) {
				ritual = true;
			}
			
			const result = {
				name: $('.spell-name').text().trim(),
				ritual: ritual,
				description: $('.more-info-content').html().trim(),
				slug: spell,
				level: parseInt(this._getStatBlock($,'level')),
				castingTime: this._getStatBlock($,'casting-time'),
				rangeArea: range,
				components: {},
				classes: [],
				stringComponents: this._getStatBlock($,'components'),
				duration: this._getStatBlock($,'duration'),
				school: this._getStatBlock($,'school').toLowerCase(),
				attackSave: this._getStatBlock($,'attack-save'),
				damageEffect: this._getStatBlock($,'damage-effect')
			};
			
			$('.available-for .class-tag').each(function(){
				result.classes.push($(this).html().trim());
			});
			
			const cmpArr = result.stringComponents.split(',').map(e => e.trim());
			if(cmpArr.indexOf('V') > -1) {
				result.components.verbal = true;
			}
			if(cmpArr.indexOf('S') > -1) {
				result.components.somatic = true;
			}
			if(cmpArr.indexOf('M') > -1) {
				result.components.material = true;
			}
			if(cmpArr.indexOf('M *') > -1) {
				result.components.material = components
					.trim()
					.replace(/^\*\s+-\s+\(/,'')
					.replace(/\)\s*$/g,'')
					.replace(/;\s*and/g, ';')
					.split(';')
					.map(e => e.trim());
			}
			
			return this.getSpellIcon(result.school)
				.then(function(image) {
					result.image = image;
					return result;
				})
				.catch(function() {
					return result;
				});
		});
};

DnDBeyond.prototype.findSpell = function DnDBeyond_findSpell(str) {
	return web.get('https://www.dndbeyond.com/spells?filter-search='+encodeURIComponent(str))
		.then(function(html) {
			const $ = cheerio.load(html);
			
			const result = [];
			$('.primary-content .listing-body .info').each(function() {
				const row = $(this);
				result.push({
					name: row.find('.spell-name .name').text().trim(),
					slug: row.attr('data-slug')
				});
			});
			
			return result;
		});
};

if (!module.parent) {
	const x = new DnDBeyond();
	x.getSpellInfo('magic-missile')
		.then(result => {
			console.log(JSON.stringify(result, null, 4));
		});
}
