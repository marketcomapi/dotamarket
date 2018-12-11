/*
 * Version 1.0
 * Date: 08.12.2018
 * Description: Dota-Market.COM Public Bot
 */
 
class marketAPI {
	constructor(key) {
		this.key = key;
		this.market = 'https://dota-market.com/api?';
		this.request = require('request');
	}
	doRequest(url, json, callback) {
		this.request.get(url, function(error, response, body) {
			if ((!error && response.statusCode == 200) || (!error && response.statusCode !== 200 && JSON.parse(body).error)) callback(json ? JSON.parse(body) : body);
			else callback(false);
		});
	}
	call(method, data, callback) {
		let params = data || {};
		params.key = this.key;
		params.method = method;
		let str_params = [];
		for (var p in params) {
			str_params.push(encodeURIComponent(p) + "=" + encodeURIComponent(params[p]));
		}
		str_params = str_params.join("&");
		this.doRequest(this.market + str_params, true, function(data) {
			callback(data);
		});
	}
}
class marketBOT {
	constructor(API, min, max, sp, msp, best) {
		this.API = API;
		this.min = min;
		this.max = max;
		if (sp < 1) this.sp = 1
		else if (sp > 10000) this.sp = 10000;
		else this.sp = sp;
		if (sp < 1) this.msp = 1
		else if (msp > 10000) this.msp = 10000;
		else this.msp = msp;
		if (best) this.best = true;
		else this.best = false;
	}
	getError(id) {
		let errTEXT = "Неизвестная ошибка";
		if (id == 100) errTEXT = "Настройте ссылку на обмен";
		else if (id == 101) errTEXT = "Невозможно выйти в онлайн, проверьте ссылку на обмен";
		else if (id == 102) errTEXT = "Нет предметов для продажи, лиюо все предметы уже продаются";
		return {
			success: false,
			error: errTEXT,
			id: id
		};
	}
	check(callback) {
		console.log("Идет проверка данных...");
		let marketBOT = this,
			mcallback = callback;
		API.call('test', false, function(data) {
			if (!data.success) mcallback(data);
			else {
				marketBOT.steamid = data.steamid;
				marketBOT.uid = data.uid;
				API.call('getToken', false, function(data) {
					if (!data.success) mcallback(marketBOT.getError(100));
					else API.call('online', false, function(data) {
						if (!data.success) mcallback(marketBOT.getError(101));
						else mcallback(data);
					});
				});
			}
		});
	}
	load(callback) {
		console.log("Идет загрузка инвентаря...");
		let marketBOT = this,
			mcallback = callback;
		API.call('getInventory', {
			unlisted: 1
		}, function(data) {
			mcallback(data);
		});
	}
	online() {
		API.call('online', false, function(data) {
			if (!data.success) mcallback(marketBOT.getError(101));
		});
	}
	recheck() {
		API.call('getMyList', false, function(data) {
			if (!data.success) console.log(data);
			else data.data.items.forEach(function(item) {
				console.log(item);
				API.call('getLPriceByClass', {
					classid: item.classid,
					instanceid: item.instanceid
				}, function(data) {
					if (!data) console.log(data);
					else if (data.data.uid != marketBOT.uid) {
						let newprice = data.data.price - 0.01;
						if (newprice >= item.sprice * (marketBOT.msp / 100)) {
							API.call('edit', {
								id: item.id,
								price: newprice
							}, function(data) {
								if (data) console.log("Цена на предмет " + item.name + " снижена на " + (item.price - newprice).toFixed(2) + " Руб. [Была: " + item.price + "; Стала: " + newprice + "]");
								else console.log("Ошибка обновления цены предмета " + item.name + ": " + data.error);
							});
						}
					}
				});
			});
		});
	}
	sell(data) {
		let marketBOT = this,
			j = 0;
		if (data.length == 0) {
			console.log(marketBOT.getError(102))
		} else {
			console.log("Предварительно загружено " + data.length + " предметов для продажи");
			data.forEach(function(item, i) {
				if (item.sprice >= marketBOT.min && item.sprice <= marketBOT.max) {
					let price = 0;
					if (marketBOT.best && item.minprice > 0) price = item.minprice - 0.01;
					else price = item.sprice * (marketBOT.sp / 100);
					j++;
					setTimeout(function() {
						API.call('sell', {
							assetid: item.assetid,
							price: price
						}, function(data) {
							if (data) console.log("Предмет " + item.name + " выставлен за " + price + " Руб.");
							else console.log("Ошибка выставления предмета " + item.name + ": " + data.error);
						});
					}, j * 300);
				}
			});
		}
	}
}
const API = new marketAPI(API_KEY);
// Ваш API KEY, узнать можно на странице профиля (https://dota-market.com/panel)
const BOT = new marketBOT(API, 0, 50, 70, 50, true);
// 5 - минимальная цена предмета, который нужно продать, в Steam; 
// 50 - максимальная цена предмета, который нужно продать, в Steam;
// 70 (1 - 10000) - процент от цены в Steam; 
// 50 (1 - 10000) - нижняя граница процента от цены в Steam при автоматическом снижении цены
// true/false - ставить цену = min - 1 коп., если предмет уже есть на продаже;

BOT.check(function(data) {
	if (!data) console.log(data);
	else BOT.load(function(data) {
		if (!data) {
			console.log(data);
		} else {
			BOT.sell(data.data.items);
		}
	});
	setInterval(BOT.online, 120000);
	setInterval(BOT.recheck, 60000);
});