'use strict';
/*
 * Evergreen explainers. These are original, hand-written reference pages that
 * explain how the hazards GlobalRisk tracks are measured and what the alert
 * levels mean — the context the raw feeds don't give you.
 */
const GUIDES = [
  {
    slug: 'earthquake-magnitude-explained',
    title: 'Earthquake Magnitude Explained: What M4, M6 and M7 Really Mean',
    short: 'Magnitude vs. intensity, how often each size occurs, and typical effects.',
    desc: 'How earthquake magnitude is measured, how often quakes of each size happen, why magnitude is not the same as shaking intensity, and what to expect at M4, M6 and M7.',
    published: '2026-10-06',
    body: `
<p>When an earthquake is reported, the headline number is its <strong>magnitude</strong>: a single value describing how much energy the quake released at its source. It is the number you see on GlobalRisk's map markers and in the event tables, and it comes from the U.S. Geological Survey (USGS) feed.</p>

<h2>The scale is logarithmic</h2>
<p>Each whole step up in magnitude means roughly 32 times more energy released and about 10 times more ground motion measured on a seismogram. A magnitude 7.0 earthquake is therefore not "a bit more" than a 6.0. It releases around 32 times the energy, and about 1,000 times the energy of a magnitude 5.0.</p>

<h2>Common size classes</h2>
<table class="src-table">
<thead><tr><th>Magnitude</th><th>Class</th><th>Typical effects</th></tr></thead>
<tbody>
<tr><td>2.5 – 3.9</td><td>Minor</td><td>Often felt by people close to the epicenter; rarely causes damage.</td></tr>
<tr><td>4.0 – 4.9</td><td>Light</td><td>Noticeable shaking and rattling objects indoors; significant damage is unlikely.</td></tr>
<tr><td>5.0 – 5.9</td><td>Moderate</td><td>Can damage poorly built structures near the epicenter; well-designed buildings usually have slight damage at most.</td></tr>
<tr><td>6.0 – 6.9</td><td>Strong</td><td>Can be destructive in populated areas within tens of kilometers.</td></tr>
<tr><td>7.0 – 7.9</td><td>Major</td><td>Can cause serious damage across larger areas.</td></tr>
<tr><td>8.0 and above</td><td>Great</td><td>Can cause severe damage across regions hundreds of kilometers wide and may trigger tsunamis.</td></tr>
</tbody></table>

<h2>How often do they happen?</h2>
<p>Worldwide, the USGS estimates there are roughly 1,300 earthquakes of magnitude 5.0–5.9 each year, around 130 of 6.0–6.9, about 15 of 7.0–7.9, and on average one of magnitude 8 or greater. Smaller quakes are far more frequent; magnitude 2.5 and above are recorded many times every day.</p>

<h2>Magnitude is not the same as intensity</h2>
<p>Magnitude describes the quake itself. <strong>Intensity</strong> describes how strongly it is felt at a particular place, and it varies with distance, depth, local geology and building quality. A deep magnitude 6.5 beneath a sparsely populated region can cause little harm, while a shallow magnitude 5.5 under a city can be damaging. That is why GlobalRisk shows location and country context beside every magnitude, and why a high number alone does not always mean a disaster.</p>

<h2>Why numbers change after the first report</h2>
<p>The first magnitude published within minutes of a quake is an estimate. Agencies revise it as more seismic stations report, so a value can move by a few tenths. GlobalRisk reads the feed regularly, but an event page shows the value at the time it was last collected. The original USGS event page, linked from each GlobalRisk event, always has the latest figure.</p>

<h2>What GlobalRisk shows</h2>
<p>Earthquakes of magnitude 2.5 and above appear on the live map. Each one links to its own page with a location map, nearby activity and country context, and quakes of magnitude 5.5 and above are listed under <a href="/events">significant events</a>. See also <a href="/guides/earthquake-safety-what-to-do">what to do during an earthquake</a> and our <a href="/methodology">methodology</a>.</p>`,
  },
  {
    slug: 'earthquake-safety-what-to-do',
    title: 'Earthquake Safety: What to Do Before, During and After',
    short: 'Drop, Cover and Hold On, preparing a home, and what to do after shaking stops.',
    desc: 'Practical earthquake safety steps: how to prepare, what to do during shaking, and what to do afterwards, including tsunami and aftershock guidance.',
    published: '2026-10-06',
    body: `
<p>This guide summarizes widely published advice from disaster-management agencies. It is general information, not a substitute for instructions from your local authorities.</p>

<h2>Before an earthquake</h2>
<ul>
<li><strong>Secure heavy items.</strong> Anchor tall furniture, water heaters and televisions to walls. Keep heavy objects on low shelves.</li>
<li><strong>Know your safe spots.</strong> Identify sturdy tables or desks to shelter under, and places away from windows, mirrors and heavy shelving.</li>
<li><strong>Prepare a kit.</strong> Water, food, a flashlight, a battery or hand-crank radio, first-aid supplies, medications, and copies of important documents.</li>
<li><strong>Make a plan.</strong> Agree how family members will contact one another and where you will meet if separated.</li>
</ul>

<h2>During shaking: Drop, Cover, Hold On</h2>
<ul>
<li><strong>Drop</strong> to your hands and knees so you cannot be knocked over.</li>
<li><strong>Cover</strong> your head and neck with your arms, and shelter under a sturdy table if one is nearby.</li>
<li><strong>Hold on</strong> to your shelter until the shaking stops.</li>
<li>If you are in bed, stay there and protect your head with a pillow.</li>
<li>If you are outdoors, move away from buildings, power lines and trees into the open.</li>
<li>If you are driving, pull over somewhere clear and stay inside the vehicle.</li>
<li>Do not run outside during shaking and do not stand in doorways, which are not safer than other spots in modern buildings.</li>
</ul>

<h2>After an earthquake</h2>
<ul>
<li><strong>Expect aftershocks.</strong> Smaller quakes often follow a large one for days or weeks. Drop, Cover and Hold On each time.</li>
<li><strong>Check for injuries and hazards.</strong> Look for gas leaks, damaged wiring and structural damage. If you smell gas, leave and report it.</li>
<li><strong>Use text messages</strong> rather than calls so networks stay free for emergencies.</li>
<li><strong>If you are near the coast</strong> and the shaking was strong or long, move immediately to high ground or inland without waiting for an official warning. Tsunamis can arrive within minutes.</li>
<li>Follow guidance from local authorities and use official channels for updates.</li>
</ul>

<p>To understand the size of a reported quake, read <a href="/guides/earthquake-magnitude-explained">Earthquake Magnitude Explained</a>.</p>`,
  },
  {
    slug: 'gdacs-alert-levels-explained',
    title: 'GDACS Alert Levels Explained: Green, Orange and Red',
    short: 'What the global disaster alert system flags, and how GlobalRisk uses it.',
    desc: 'What GDACS Green, Orange and Red disaster alerts mean, which hazards it covers, and how to read them alongside local official warnings.',
    published: '2026-10-06',
    body: `
<p>GDACS, the Global Disaster Alert and Coordination System, is a cooperation framework between the United Nations and the European Commission. It provides near-real-time alerts about natural disasters around the world and is one of the public data sources behind GlobalRisk's "Alerts" layer.</p>

<h2>Hazards covered</h2>
<p>GDACS issues alerts for earthquakes, tropical cyclones, floods, volcanic activity, droughts, wildfires and tsunamis. Each alert includes the event type, location, country, a severity description and a link to its detailed report.</p>

<h2>What the colors mean</h2>
<ul>
<li><strong>Green:</strong> An event was detected but is expected to have a limited humanitarian impact. These are not shown as alerts on GlobalRisk to avoid noise.</li>
<li><strong>Orange:</strong> The event may have a significant humanitarian impact. On GlobalRisk this maps to the <em>high</em> severity level.</li>
<li><strong>Red:</strong> The event is expected to have a high humanitarian impact and may call for international attention. On GlobalRisk this maps to the <em>extreme</em> severity level.</li>
</ul>
<p>Alert levels are computed from the physical size of the event combined with exposure and vulnerability estimates, such as how many people live in the affected area. This is why a moderate earthquake near a dense population can receive a higher alert than a stronger one far offshore.</p>

<h2>Things to keep in mind</h2>
<ul>
<li>An alert is an automated assessment. It is produced quickly and may be revised as better data arrives.</li>
<li>GDACS is a coordination tool for humanitarian responders, not a public warning service for individuals.</li>
<li>For evacuation orders, shelter locations and instructions, always follow your national and local authorities.</li>
</ul>

<h2>How GlobalRisk uses it</h2>
<p>GlobalRisk stores Orange and Red alerts, places them on the map and in country pages, and links each one back to the GDACS report. You can browse them under <a href="/events">recent events</a>. For cyclone alerts, see <a href="/guides/tropical-cyclone-categories-explained">Tropical Cyclone Categories Explained</a>.</p>`,
  },
  {
    slug: 'tropical-cyclone-categories-explained',
    title: 'Tropical Cyclone Categories Explained: Hurricanes, Typhoons and the Saffir-Simpson Scale',
    short: 'Why hurricanes and typhoons are the same thing, and what Category 1–5 mean.',
    desc: 'Hurricanes, typhoons and cyclones are the same kind of storm. Learn how the Saffir-Simpson categories work, and why wind speed is only part of the danger.',
    published: '2026-10-06',
    body: `
<p>Hurricane, typhoon and cyclone are regional names for the same type of storm: a rotating, organized system of thunderstorms that forms over warm tropical oceans. The name depends on where it forms.</p>

<h2>Names by region</h2>
<ul>
<li><strong>Hurricane:</strong> North Atlantic and the central and eastern North Pacific.</li>
<li><strong>Typhoon:</strong> Northwest Pacific.</li>
<li><strong>Cyclone:</strong> South Pacific and Indian Ocean.</li>
</ul>

<h2>The Saffir-Simpson scale</h2>
<p>The most commonly quoted rating ranks storms by sustained wind speed, from Category 1 to Category 5:</p>
<table class="src-table">
<thead><tr><th>Category</th><th>Sustained winds</th></tr></thead>
<tbody>
<tr><td>1</td><td>119–153 km/h (74–95 mph)</td></tr>
<tr><td>2</td><td>154–177 km/h (96–110 mph)</td></tr>
<tr><td>3</td><td>178–208 km/h (111–129 mph)</td></tr>
<tr><td>4</td><td>209–251 km/h (130–156 mph)</td></tr>
<tr><td>5</td><td>252 km/h (157 mph) or higher</td></tr>
</tbody></table>
<p>Categories 3 and above are usually called "major" storms. Weaker systems are classed as tropical depressions or tropical storms, based on lower wind speeds.</p>

<h2>Wind speed is only part of the danger</h2>
<p>The category describes wind only. Many of the deadliest effects of tropical cyclones come from other hazards:</p>
<ul>
<li><strong>Storm surge:</strong> sea water pushed onshore, often the greatest threat to life along the coast.</li>
<li><strong>Rainfall flooding:</strong> slow-moving storms can drop huge amounts of rain far from the coast.</li>
<li><strong>Tornadoes and landslides</strong> in the outer bands and over hilly terrain.</li>
</ul>
<p>A lower-category storm that moves slowly or hits a low-lying area can be more destructive than a higher-category one that passes quickly.</p>

<h2>On GlobalRisk</h2>
<p>Tropical cyclone alerts come from GDACS (see <a href="/guides/gdacs-alert-levels-explained">GDACS alert levels</a>) and active storm events from NASA EONET. The category shown is the one reported by the source at the time it was collected, and it changes as the storm strengthens or weakens. Always follow your national weather service for forecasts and warnings.</p>`,
  },
  {
    slug: 'how-satellite-fire-detection-works',
    title: 'How Satellites Detect Wildfires: A Plain-Language Guide to Thermal Hotspots',
    short: 'What a fire hotspot is, how often satellites pass, and why detections are not exact.',
    desc: 'How satellite instruments such as VIIRS and MODIS detect wildfires, what a hotspot represents, how often they update, and the limits of the data.',
    published: '2026-10-06',
    body: `
<p>Fire layers on a map, including those on GlobalRisk, are built from <strong>thermal hotspots</strong> detected by Earth-observing satellites. NASA distributes them through FIRMS, the Fire Information for Resource Management System, and they are used by fire agencies and researchers worldwide.</p>

<h2>How detection works</h2>
<p>Instruments such as MODIS and VIIRS measure infrared energy radiating from the ground. A fire is much hotter than its surroundings, so the sensor sees a pixel that is unusually bright at certain infrared wavelengths. Software compares each pixel with its neighbors and flags those that are anomalously hot. Each flagged pixel becomes a "hotspot" with a location, time, and an estimate of fire radiative power.</p>

<h2>What a hotspot is, and is not</h2>
<ul>
<li>A hotspot marks a <strong>pixel</strong> roughly 375 meters to 1 kilometer across, depending on the instrument, that contains a heat source. It is not a precise fire perimeter.</li>
<li>One large fire usually produces many hotspots; a single hotspot may be a small fire.</li>
<li>Not every hotspot is a wildfire. Agricultural burning, gas flares, industrial heat sources and some volcanic activity can also be detected.</li>
</ul>

<h2>How fresh is it?</h2>
<p>Polar-orbiting satellites pass over any given location a few times per day, so a fire can burn for hours before it is seen. Data is typically available within about three hours of observation in "near-real-time" products, then refined later. Heavy cloud cover and thick smoke can hide fires, and very small or short fires may be missed entirely.</p>

<h2>Reading fire data responsibly</h2>
<ul>
<li>A cluster of hotspots in a forested area during a dry season is a stronger signal than an isolated point in farmland.</li>
<li>Use hotspots to see where fire activity <em>is</em> detected, not where it is <em>not</em>. Missing hotspots do not prove an area is safe.</li>
<li>For evacuation notices and fire perimeters, rely on your local fire or emergency authority.</li>
</ul>

<p>Fire and other natural events also appear in <a href="/events">recent events</a> and on country pages. For the other feeds we use, see the <a href="/methodology">methodology</a>.</p>`,
  },
  {
    slug: 'pacific-ring-of-fire-explained',
    title: 'The Pacific Ring of Fire: Why So Many Earthquakes and Volcanoes Cluster Here',
    short: 'The horseshoe of plate boundaries that produces most of the world\'s large quakes.',
    desc: 'What the Pacific Ring of Fire is, why it concentrates earthquakes and volcanoes, which countries lie along it, and what that means for the events you see on the map.',
    published: '2026-10-06',
    body: `
<p>If you watch the GlobalRisk map for a few days, you will notice that earthquake markers are not spread evenly around the globe. They cluster along certain lines, and the most striking is a huge horseshoe around the Pacific Ocean known as the <strong>Ring of Fire</strong>.</p>

<h2>What it is</h2>
<p>The Ring of Fire is a belt of plate boundaries about 40,000 kilometers long that stretches from the southern tip of South America, up the west coast of the Americas, across the Aleutian Islands and Alaska, and down through Japan, the Philippines, Indonesia and New Zealand. It is not a single fault but a chain of subduction zones and transform boundaries.</p>

<h2>Why it is so active</h2>
<p>The Pacific Plate and several smaller plates are moving against the surrounding plates. In a <strong>subduction zone</strong>, one plate slides beneath another and sinks into the mantle. The plates lock together, build up stress for decades or centuries, and then slip suddenly, producing earthquakes. As the sinking plate heats up, it releases water that helps melt the mantle above it, feeding chains of volcanoes.</p>

<h2>The numbers</h2>
<ul>
<li>Roughly 90 percent of the world's earthquakes occur along the Ring of Fire.</li>
<li>About 80 percent of the largest earthquakes strike there.</li>
<li>More than 450 volcanoes, roughly three-quarters of the world's active and dormant volcanoes, lie along it.</li>
</ul>

<h2>Countries along the ring</h2>
<p>Chile, Peru, Mexico, the United States and Canada on the Americas side; Russia, Japan, Taiwan, the Philippines, Indonesia and Papua New Guinea in Asia; and New Zealand, Fiji, Vanuatu and the Solomon Islands in the southwest Pacific all sit on or near the ring. You will see these countries appear again and again on the <a href="/countries">country pages</a>.</p>

<h2>Other earthquake belts</h2>
<p>Not all large quakes occur on the ring. The Alpide belt, running from the Mediterranean through Turkey, Iran and the Himalayas to Indonesia, produces many damaging quakes. Mid-ocean ridges generate frequent but mostly offshore, smaller earthquakes.</p>

<h2>Reading the map</h2>
<p>Frequent activity in a region does not mean every event is dangerous. Most quakes are small, and many occur far offshore. To judge a specific event, check its magnitude, location and depth; see <a href="/guides/earthquake-magnitude-explained">Earthquake Magnitude Explained</a>.</p>`,
  },
];

module.exports = { GUIDES, bySlug: (s) => GUIDES.find((g) => g.slug === s) };
