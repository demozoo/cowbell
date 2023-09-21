// Generated automatically with "fut". Do not edit.

const NmiStatus = {
	RESET : 0,
	ON_V_BLANK : 1,
	WAS_V_BLANK : 2
}

/**
 * Atari 8-bit chip music emulator.
 * This class performs no I/O operations - all music data must be passed in byte arrays.
 */
export class ASAP
{
	constructor()
	{
		this.#silenceCycles = 0;
		this.#cpu.asap = this;
	}

	/**
	 * Default output sample rate.
	 */
	static SAMPLE_RATE = 44100;
	nextEventCycle;
	#cpu = new Cpu6502();
	#nextScanlineCycle;
	#nmist;
	#consol;
	#covox = new Uint8Array(4);
	#pokeys = new PokeyPair();
	#moduleInfo = new ASAPInfo();
	#nextPlayerCycle;
	#tmcPerFrameCounter;
	#currentSong;
	#currentDuration;
	#blocksPlayed;
	#silenceCycles;
	#silenceCyclesCounter;
	#gtiaOrCovoxPlayedThisFrame;
	#currentSampleRate = 44100;

	/**
	 * Returns the output sample rate.
	 */
	getSampleRate()
	{
		return this.#currentSampleRate;
	}

	/**
	 * Sets the output sample rate.
	 */
	setSampleRate(sampleRate)
	{
		this.#currentSampleRate = sampleRate;
	}

	/**
	 * Enables silence detection.
	 * Causes playback to stop after the specified period of silence.
	 * @param seconds Length of silence which ends playback. Zero disables silence detection.
	 */
	detectSilence(seconds)
	{
		this.#silenceCyclesCounter = this.#silenceCycles = seconds * 1773447;
	}

	peekHardware(addr)
	{
		switch (addr & 65311) {
		case 53268:
			return this.#moduleInfo.isNtsc() ? 15 : 1;
		case 53279:
			return ~this.#consol & 15;
		case 53770:
		case 53786:
		case 53774:
		case 53790:
			return this.#pokeys.peek(addr, this.#cpu.cycle);
		case 53772:
		case 53788:
		case 53775:
		case 53791:
			return 255;
		case 54283:
		case 54299:
			let cycle = this.#cpu.cycle;
			if (cycle > (this.#moduleInfo.isNtsc() ? 29868 : 35568))
				return 0;
			return cycle / 228 | 0;
		case 54287:
		case 54303:
			switch (this.#nmist) {
			case NmiStatus.RESET:
				return 31;
			case NmiStatus.WAS_V_BLANK:
				return 95;
			default:
				return this.#cpu.cycle < 28291 ? 31 : 95;
			}
		default:
			return this.#cpu.memory[addr];
		}
	}

	pokeHardware(addr, data)
	{
		if (addr >> 8 == 210) {
			let t = this.#pokeys.poke(addr, data, this.#cpu.cycle);
			if (this.nextEventCycle > t)
				this.nextEventCycle = t;
		}
		else if ((addr & 65295) == 54282) {
			let x = this.#cpu.cycle % 114;
			this.#cpu.cycle += (x <= 106 ? 106 : 220) - x;
		}
		else if ((addr & 65295) == 54287) {
			this.#nmist = this.#cpu.cycle < 28292 ? NmiStatus.ON_V_BLANK : NmiStatus.RESET;
		}
		else if ((addr & 65280) == this.#moduleInfo.getCovoxAddress()) {
			let pokey;
			addr &= 3;
			if (addr == 0 || addr == 3)
				pokey = this.#pokeys.basePokey;
			else
				pokey = this.#pokeys.extraPokey;
			let delta = data - this.#covox[addr];
			if (delta != 0) {
				pokey.addExternalDelta(this.#pokeys, this.#cpu.cycle, delta << 17);
				this.#covox[addr] = data;
				this.#gtiaOrCovoxPlayedThisFrame = true;
			}
		}
		else if ((addr & 65311) == 53279) {
			let delta = ((this.#consol & 8) - (data & 8)) << 20;
			if (delta != 0) {
				let cycle = this.#cpu.cycle;
				this.#pokeys.basePokey.addExternalDelta(this.#pokeys, cycle, delta);
				this.#pokeys.extraPokey.addExternalDelta(this.#pokeys, cycle, delta);
				this.#gtiaOrCovoxPlayedThisFrame = true;
			}
			this.#consol = data;
		}
		else
			this.#cpu.memory[addr] = data;
	}

	#call6502(addr)
	{
		this.#cpu.memory[53760] = 32;
		this.#cpu.memory[53761] = addr & 255;
		this.#cpu.memory[53762] = addr >> 8;
		this.#cpu.memory[53763] = 210;
		this.#cpu.pc = 53760;
	}

	#call6502Player()
	{
		let player = this.#moduleInfo.player;
		switch (this.#moduleInfo.type) {
		case ASAPModuleType.SAP_B:
			this.#call6502(player);
			break;
		case ASAPModuleType.SAP_C:
		case ASAPModuleType.CMC:
		case ASAPModuleType.CM3:
		case ASAPModuleType.CMR:
		case ASAPModuleType.CMS:
			this.#call6502(player + 6);
			break;
		case ASAPModuleType.SAP_D:
			if (player >= 0) {
				this.#cpu.pushPc();
				this.#cpu.memory[53760] = 8;
				this.#cpu.memory[53761] = 72;
				this.#cpu.memory[53762] = 138;
				this.#cpu.memory[53763] = 72;
				this.#cpu.memory[53764] = 152;
				this.#cpu.memory[53765] = 72;
				this.#cpu.memory[53766] = 32;
				this.#cpu.memory[53767] = player & 255;
				this.#cpu.memory[53768] = player >> 8;
				this.#cpu.memory[53769] = 104;
				this.#cpu.memory[53770] = 168;
				this.#cpu.memory[53771] = 104;
				this.#cpu.memory[53772] = 170;
				this.#cpu.memory[53773] = 104;
				this.#cpu.memory[53774] = 64;
				this.#cpu.pc = 53760;
			}
			break;
		case ASAPModuleType.SAP_S:
			let i = this.#cpu.memory[69] - 1;
			this.#cpu.memory[69] = i & 255;
			if (i == 0)
				this.#cpu.memory[45179] = (this.#cpu.memory[45179] + 1) & 255;
			break;
		case ASAPModuleType.DLT:
			this.#call6502(player + 259);
			break;
		case ASAPModuleType.MPT:
		case ASAPModuleType.RMT:
		case ASAPModuleType.TM2:
		case ASAPModuleType.FC:
			this.#call6502(player + 3);
			break;
		case ASAPModuleType.TMC:
			if (--this.#tmcPerFrameCounter <= 0) {
				this.#tmcPerFrameCounter = this.#cpu.memory[this.#moduleInfo.getMusicAddress() + 31];
				this.#call6502(player + 3);
			}
			else
				this.#call6502(player + 6);
			break;
		}
	}

	isIrq()
	{
		return this.#pokeys.basePokey.irqst != 255;
	}

	handleEvent()
	{
		let cycle = this.#cpu.cycle;
		if (cycle >= this.#nextScanlineCycle) {
			if (cycle - this.#nextScanlineCycle < 50)
				this.#cpu.cycle = cycle += 9;
			this.#nextScanlineCycle += 114;
			if (cycle >= this.#nextPlayerCycle) {
				this.#call6502Player();
				this.#nextPlayerCycle += 114 * this.#moduleInfo.getPlayerRateScanlines();
			}
		}
		let nextEventCycle = this.#nextScanlineCycle;
		nextEventCycle = this.#pokeys.basePokey.checkIrq(cycle, nextEventCycle);
		nextEventCycle = this.#pokeys.extraPokey.checkIrq(cycle, nextEventCycle);
		this.nextEventCycle = nextEventCycle;
	}

	#do6502Frame()
	{
		this.nextEventCycle = 0;
		this.#nextScanlineCycle = 0;
		this.#nmist = this.#nmist == NmiStatus.RESET ? NmiStatus.ON_V_BLANK : NmiStatus.WAS_V_BLANK;
		let cycles = this.#moduleInfo.isNtsc() ? 29868 : 35568;
		this.#cpu.doFrame(cycles);
		this.#cpu.cycle -= cycles;
		if (this.#nextPlayerCycle != 8388608)
			this.#nextPlayerCycle -= cycles;
		for (let i = 3;; i >>= 1) {
			this.#pokeys.basePokey.channels[i].endFrame(cycles);
			this.#pokeys.extraPokey.channels[i].endFrame(cycles);
			if (i == 0)
				break;
		}
		return cycles;
	}

	#doFrame()
	{
		this.#gtiaOrCovoxPlayedThisFrame = false;
		this.#pokeys.startFrame();
		let cycles = this.#do6502Frame();
		this.#pokeys.endFrame(cycles);
		return cycles;
	}

	/**
	 * Loads music data ("module").
	 * @param filename Filename, used to determine the format.
	 * @param module Contents of the file.
	 * @param moduleLen Length of the file.
	 */
	load(filename, module, moduleLen)
	{
		this.#moduleInfo.load(filename, module, moduleLen);
		let playerRoutine = ASAP6502.getPlayerRoutine(this.#moduleInfo);
		if (playerRoutine != null) {
			let player = ASAPInfo.getWord(playerRoutine, 2);
			let playerLastByte = ASAPInfo.getWord(playerRoutine, 4);
			let music = this.#moduleInfo.getMusicAddress();
			if (music <= playerLastByte)
				throw new ASAPFormatException("Module address conflicts with the player routine");
			this.#cpu.memory[19456] = 0;
			if (this.#moduleInfo.type == ASAPModuleType.FC)
				this.#cpu.memory.set(module.subarray(0, moduleLen), music);
			else
				this.#cpu.memory.set(module.subarray(6, 6 + moduleLen - 6), music);
			this.#cpu.memory.set(playerRoutine.subarray(6, 6 + playerLastByte + 1 - player), player);
			if (this.#moduleInfo.player < 0)
				this.#moduleInfo.player = player;
			return;
		}
		this.#cpu.memory.fill(0);
		let moduleIndex = this.#moduleInfo.headerLen + 2;
		while (moduleIndex + 5 <= moduleLen) {
			let startAddr = ASAPInfo.getWord(module, moduleIndex);
			let blockLen = ASAPInfo.getWord(module, moduleIndex + 2) + 1 - startAddr;
			if (blockLen <= 0 || moduleIndex + blockLen > moduleLen)
				throw new ASAPFormatException("Invalid binary block");
			moduleIndex += 4;
			this.#cpu.memory.set(module.subarray(moduleIndex, moduleIndex + blockLen), startAddr);
			moduleIndex += blockLen;
			if (moduleIndex == moduleLen)
				return;
			if (moduleIndex + 7 <= moduleLen && module[moduleIndex] == 255 && module[moduleIndex + 1] == 255)
				moduleIndex += 2;
		}
		throw new ASAPFormatException("Invalid binary block");
	}

	/**
	 * Returns information about the loaded module.
	 */
	getInfo()
	{
		return this.#moduleInfo;
	}

	#do6502Init(pc, a, x, y)
	{
		this.#cpu.pc = pc;
		this.#cpu.a = a & 255;
		this.#cpu.x = x & 255;
		this.#cpu.y = y & 255;
		this.#cpu.memory[53760] = 210;
		this.#cpu.memory[510] = 255;
		this.#cpu.memory[511] = 209;
		this.#cpu.s = 253;
		for (let frame = 0; frame < 50; frame++) {
			this.#do6502Frame();
			if (this.#cpu.pc == 53760)
				return;
		}
		throw new ASAPFormatException("INIT routine didn't return");
	}

	/**
	 * Mutes the selected POKEY channels.
	 * @param mask An 8-bit mask which selects POKEY channels to be muted.
	 */
	mutePokeyChannels(mask)
	{
		this.#pokeys.basePokey.mute(mask);
		this.#pokeys.extraPokey.mute(mask >> 4);
	}

	#restartSong()
	{
		this.#nextPlayerCycle = 8388608;
		this.#blocksPlayed = 0;
		this.#silenceCyclesCounter = this.#silenceCycles;
		this.#cpu.reset();
		this.#nmist = NmiStatus.ON_V_BLANK;
		this.#consol = 8;
		this.#covox[0] = 128;
		this.#covox[1] = 128;
		this.#covox[2] = 128;
		this.#covox[3] = 128;
		this.#pokeys.initialize(this.#moduleInfo.isNtsc(), this.#moduleInfo.getChannels() > 1, this.#currentSampleRate);
		this.mutePokeyChannels(255);
		let player = this.#moduleInfo.player;
		let music = this.#moduleInfo.getMusicAddress();
		switch (this.#moduleInfo.type) {
		case ASAPModuleType.SAP_B:
			this.#do6502Init(this.#moduleInfo.getInitAddress(), this.#currentSong, 0, 0);
			break;
		case ASAPModuleType.SAP_C:
		case ASAPModuleType.CMC:
		case ASAPModuleType.CM3:
		case ASAPModuleType.CMR:
		case ASAPModuleType.CMS:
			this.#do6502Init(player + 3, 112, music, music >> 8);
			this.#do6502Init(player + 3, 0, this.#currentSong, 0);
			break;
		case ASAPModuleType.SAP_D:
		case ASAPModuleType.SAP_S:
			this.#cpu.pc = this.#moduleInfo.getInitAddress();
			this.#cpu.a = this.#currentSong;
			this.#cpu.x = 0;
			this.#cpu.y = 0;
			this.#cpu.s = 255;
			break;
		case ASAPModuleType.DLT:
			this.#do6502Init(player + 256, 0, 0, this.#moduleInfo.songPos[this.#currentSong]);
			break;
		case ASAPModuleType.MPT:
			this.#do6502Init(player, 0, music >> 8, music);
			this.#do6502Init(player, 2, this.#moduleInfo.songPos[this.#currentSong], 0);
			break;
		case ASAPModuleType.RMT:
			this.#do6502Init(player, this.#moduleInfo.songPos[this.#currentSong], music, music >> 8);
			break;
		case ASAPModuleType.TMC:
		case ASAPModuleType.TM2:
			this.#do6502Init(player, 112, music >> 8, music);
			this.#do6502Init(player, 0, this.#currentSong, 0);
			this.#tmcPerFrameCounter = 1;
			break;
		case ASAPModuleType.FC:
			this.#do6502Init(player, this.#currentSong, 0, 0);
			break;
		}
		this.mutePokeyChannels(0);
		this.#nextPlayerCycle = 0;
	}

	/**
	 * Prepares playback of the specified song of the loaded module.
	 * @param song Zero-based song index.
	 * @param duration Playback time in milliseconds, -1 means infinity.
	 */
	playSong(song, duration)
	{
		if (song < 0 || song >= this.#moduleInfo.getSongs())
			throw new ASAPArgumentException("Song number out of range");
		this.#currentSong = song;
		this.#currentDuration = duration;
		this.#restartSong();
	}

	/**
	 * Returns current playback position in blocks.
	 * A block is one sample or a pair of samples for stereo.
	 */
	getBlocksPlayed()
	{
		return this.#blocksPlayed;
	}

	/**
	 * Returns current playback position in milliseconds.
	 */
	getPosition()
	{
		return this.#blocksPlayed * 10 / (this.#currentSampleRate / 100 | 0) | 0;
	}

	#millisecondsToBlocks(milliseconds)
	{
		let ms = BigInt(milliseconds);
		return Number(ms * BigInt(this.#currentSampleRate) / 1000n);
	}

	/**
	 * Changes the playback position.
	 * @param block The requested absolute position in samples (always 44100 per second, even in stereo).
	 */
	seekSample(block)
	{
		if (block < this.#blocksPlayed)
			this.#restartSong();
		while (this.#blocksPlayed + this.#pokeys.readySamplesEnd < block) {
			this.#blocksPlayed += this.#pokeys.readySamplesEnd;
			this.#doFrame();
		}
		this.#pokeys.readySamplesStart = block - this.#blocksPlayed;
		this.#blocksPlayed = block;
	}

	/**
	 * Changes the playback position.
	 * @param position The requested absolute position in milliseconds.
	 */
	seek(position)
	{
		this.seekSample(this.#millisecondsToBlocks(position));
	}

	static #putLittleEndian(buffer, offset, value)
	{
		buffer[offset] = value & 255;
		buffer[offset + 1] = value >> 8 & 255;
		buffer[offset + 2] = value >> 16 & 255;
		buffer[offset + 3] = value >> 24 & 255;
	}

	static #fourCC(s)
	{
		return (s.charCodeAt(0) | s.charCodeAt(1) << 8 | s.charCodeAt(2) << 16 | s.charCodeAt(3) << 24) & 2147483647;
	}

	static #putLittleEndians(buffer, offset, value1, value2)
	{
		ASAP.#putLittleEndian(buffer, offset, value1);
		ASAP.#putLittleEndian(buffer, offset + 4, value2);
	}

	static #putWavMetadata(buffer, offset, fourCC, value)
	{
		let len = value.length;
		if (len > 0) {
			ASAP.#putLittleEndians(buffer, offset, fourCC, (len | 1) + 1);
			offset += 8;
			for (let i = 0; i < len; i++)
				buffer[offset++] = value.charCodeAt(i);
			buffer[offset++] = 0;
			if ((len & 1) == 0)
				buffer[offset++] = 0;
		}
		return offset;
	}

	/**
	 * Fills leading bytes of the specified buffer with WAV file header.
	 * Returns the number of changed bytes.
	 * @param buffer The destination buffer.
	 * @param format Format of samples.
	 * @param metadata Include metadata (title, author, date).
	 */
	getWavHeader(buffer, format, metadata)
	{
		let use16bit = format != ASAPSampleFormat.U8 ? 1 : 0;
		let blockSize = this.#moduleInfo.getChannels() << use16bit;
		let bytesPerSecond = this.#currentSampleRate * blockSize;
		let totalBlocks = this.#millisecondsToBlocks(this.#currentDuration);
		let nBytes = (totalBlocks - this.#blocksPlayed) * blockSize;
		ASAP.#putLittleEndian(buffer, 8, 1163280727);
		ASAP.#putLittleEndians(buffer, 12, 544501094, 16);
		buffer[20] = 1;
		buffer[21] = 0;
		buffer[22] = this.#moduleInfo.getChannels();
		buffer[23] = 0;
		ASAP.#putLittleEndians(buffer, 24, this.#currentSampleRate, bytesPerSecond);
		buffer[32] = blockSize;
		buffer[33] = 0;
		buffer[34] = 8 << use16bit;
		buffer[35] = 0;
		let i = 36;
		if (metadata) {
			let year = this.#moduleInfo.getYear();
			if (this.#moduleInfo.getTitle().length > 0 || this.#moduleInfo.getAuthor().length > 0 || year > 0) {
				ASAP.#putLittleEndian(buffer, 44, 1330007625);
				i = ASAP.#putWavMetadata(buffer, 48, 1296125513, this.#moduleInfo.getTitle());
				i = ASAP.#putWavMetadata(buffer, i, 1414676809, this.#moduleInfo.getAuthor());
				if (year > 0) {
					ASAP.#putLittleEndians(buffer, i, 1146241865, 6);
					for (let j = 3; j >= 0; j--) {
						buffer[i + 8 + j] = 48 + year % 10;
						year = year / 10 | 0;
					}
					buffer[i + 12] = 0;
					buffer[i + 13] = 0;
					i += 14;
				}
				ASAP.#putLittleEndians(buffer, 36, 1414744396, i - 44);
			}
		}
		ASAP.#putLittleEndians(buffer, 0, 1179011410, i + nBytes);
		ASAP.#putLittleEndians(buffer, i, 1635017060, nBytes);
		return i + 8;
	}

	#generateAt(buffer, bufferOffset, bufferLen, format)
	{
		if (this.#silenceCycles > 0 && this.#silenceCyclesCounter <= 0)
			return 0;
		let blockShift = this.#moduleInfo.getChannels() - (format == ASAPSampleFormat.U8 ? 1 : 0);
		let bufferBlocks = bufferLen >> blockShift;
		if (this.#currentDuration > 0) {
			let totalBlocks = this.#millisecondsToBlocks(this.#currentDuration);
			if (bufferBlocks > totalBlocks - this.#blocksPlayed)
				bufferBlocks = totalBlocks - this.#blocksPlayed;
		}
		let block = 0;
		for (;;) {
			let blocks = this.#pokeys.generate(buffer, bufferOffset + (block << blockShift), bufferBlocks - block, format);
			this.#blocksPlayed += blocks;
			block += blocks;
			if (block >= bufferBlocks)
				break;
			let cycles = this.#doFrame();
			if (this.#silenceCycles > 0) {
				if (this.#pokeys.isSilent() && !this.#gtiaOrCovoxPlayedThisFrame) {
					this.#silenceCyclesCounter -= cycles;
					if (this.#silenceCyclesCounter <= 0)
						break;
				}
				else
					this.#silenceCyclesCounter = this.#silenceCycles;
			}
		}
		return block << blockShift;
	}

	/**
	 * Fills the specified buffer with generated samples.
	 * @param buffer The destination buffer.
	 * @param bufferLen Number of bytes to fill.
	 * @param format Format of samples.
	 */
	generate(buffer, bufferLen, format)
	{
		return this.#generateAt(buffer, 0, bufferLen, format);
	}

	/**
	 * Returns POKEY channel volume - an integer between 0 and 15.
	 * @param channel POKEY channel number (from 0 to 7).
	 */
	getPokeyChannelVolume(channel)
	{
		let pokey = (channel & 4) == 0 ? this.#pokeys.basePokey : this.#pokeys.extraPokey;
		return pokey.channels[channel & 3].audc & 15;
	}
}

class ASAP6502
{

	static getPlayerRoutine(info)
	{
		switch (info.type) {
		case ASAPModuleType.CMC:
			return Fu.cmc_obx;
		case ASAPModuleType.CM3:
			return Fu.cm3_obx;
		case ASAPModuleType.CMR:
			return Fu.cmr_obx;
		case ASAPModuleType.CMS:
			return Fu.cms_obx;
		case ASAPModuleType.DLT:
			return Fu.dlt_obx;
		case ASAPModuleType.MPT:
			return Fu.mpt_obx;
		case ASAPModuleType.RMT:
			return info.getChannels() == 1 ? Fu.rmt4_obx : Fu.rmt8_obx;
		case ASAPModuleType.TMC:
			return Fu.tmc_obx;
		case ASAPModuleType.TM2:
			return Fu.tm2_obx;
		case ASAPModuleType.FC:
			return Fu.fc_obx;
		default:
			return null;
		}
	}
}

const ASAPModuleType = {
	SAP_B : 0,
	SAP_C : 1,
	SAP_D : 2,
	SAP_S : 3,
	CMC : 4,
	CM3 : 5,
	CMR : 6,
	CMS : 7,
	DLT : 8,
	MPT : 9,
	RMT : 10,
	TMC : 11,
	TM2 : 12,
	FC : 13
}

/**
 * Exception thrown when the input file is invalid.
 */
export class ASAPFormatException extends Error
{
	name = "ASAPFormatException";
}

/**
 * Exception thrown when an invalid argument is passed.
 */
export class ASAPArgumentException extends Error
{
	name = "ASAPArgumentException";
}

class DurationParser
{
	#source;
	#position;
	#length;

	#parseDigit(max)
	{
		if (this.#position >= this.#length)
			throw new ASAPFormatException("Invalid duration");
		let digit = this.#source.charCodeAt(this.#position++) - 48;
		if (digit < 0 || digit > max)
			throw new ASAPFormatException("Invalid duration");
		return digit;
	}

	parse(s)
	{
		this.#source = s;
		this.#position = 0;
		this.#length = s.length;
		let result = this.#parseDigit(9);
		let digit;
		if (this.#position < this.#length) {
			digit = s.charCodeAt(this.#position) - 48;
			if (digit >= 0 && digit <= 9) {
				this.#position++;
				result = result * 10 + digit;
			}
			if (this.#position < this.#length && s.charCodeAt(this.#position) == 58) {
				this.#position++;
				digit = this.#parseDigit(5);
				result = result * 60 + digit * 10;
				digit = this.#parseDigit(9);
				result += digit;
			}
		}
		result *= 1000;
		if (this.#position >= this.#length)
			return result;
		if (s.charCodeAt(this.#position++) != 46)
			throw new ASAPFormatException("Invalid duration");
		digit = this.#parseDigit(9);
		result += digit * 100;
		if (this.#position >= this.#length)
			return result;
		digit = this.#parseDigit(9);
		result += digit * 10;
		if (this.#position >= this.#length)
			return result;
		digit = this.#parseDigit(9);
		result += digit;
		return result;
	}
}

/**
 * Information about a music file.
 */
export class ASAPInfo
{
	constructor()
	{
	}

	/**
	 * ASAP version - major part.
	 */
	static VERSION_MAJOR = 6;

	/**
	 * ASAP version - minor part.
	 */
	static VERSION_MINOR = 0;

	/**
	 * ASAP version - micro part.
	 */
	static VERSION_MICRO = 1;

	/**
	 * ASAP version as a string.
	 */
	static VERSION = "6.0.1";

	/**
	 * Years ASAP was created in.
	 */
	static YEARS = "2005-2023";

	/**
	 * Short credits for ASAP.
	 */
	static CREDITS = "Another Slight Atari Player (C) 2005-2023 Piotr Fusik\nCMC, MPT, TMC, TM2 players (C) 1994-2005 Marcin Lewandowski\nRMT player (C) 2002-2005 Radek Sterba\nDLT player (C) 2009 Marek Konopka\nCMS player (C) 1999 David Spilka\nFC player (C) 2011 Jerzy Kut\n";

	/**
	 * Short license notice.
	 * Display after the credits.
	 */
	static COPYRIGHT = "This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or (at your option) any later version.";

	/**
	 * Maximum length of a supported input file.
	 * You may assume that files longer than this are not supported by ASAP.
	 */
	static MAX_MODULE_LENGTH = 65000;

	/**
	 * Maximum length of text metadata.
	 */
	static MAX_TEXT_LENGTH = 127;

	/**
	 * Maximum number of songs in a file.
	 */
	static MAX_SONGS = 32;
	#filename;
	#author;
	#title;
	#date;
	#channels;
	#songs;
	#defaultSong;
	#durations = new Int32Array(32);
	#loops = new Array(32);
	#ntsc;
	type;
	#fastplay;
	#music;
	#init;
	player;
	#covoxAddr;
	headerLen;
	songPos = new Uint8Array(32);

	static #isValidChar(c)
	{
		return c >= 32 && c <= 124 && c != 96 && c != 123;
	}

	static getWord(array, i)
	{
		return array[i] + (array[i + 1] << 8);
	}

	#parseModule(module, moduleLen)
	{
		if ((module[0] != 255 || module[1] != 255) && (module[0] != 0 || module[1] != 0))
			throw new ASAPFormatException("Invalid two leading bytes of the module");
		this.#music = ASAPInfo.getWord(module, 2);
		let musicLastByte = ASAPInfo.getWord(module, 4);
		if (this.#music <= 55295 && musicLastByte >= 53248)
			throw new ASAPFormatException("Module address conflicts with hardware registers");
		let blockLen = musicLastByte + 1 - this.#music;
		if (6 + blockLen != moduleLen) {
			if (this.type != ASAPModuleType.RMT || 11 + blockLen > moduleLen)
				throw new ASAPFormatException("Module length doesn't match headers");
			let infoAddr = ASAPInfo.getWord(module, 6 + blockLen);
			if (infoAddr != this.#music + blockLen)
				throw new ASAPFormatException("Invalid address of RMT info");
			let infoLen = ASAPInfo.getWord(module, 8 + blockLen) + 1 - infoAddr;
			if (10 + blockLen + infoLen != moduleLen)
				throw new ASAPFormatException("Invalid RMT info block");
		}
	}

	#addSong(playerCalls)
	{
		let scanlines = BigInt(playerCalls * this.#fastplay);
		this.#durations[this.#songs++] = Number(scanlines * 38000n / 591149n);
	}

	#parseCmcSong(module, pos)
	{
		let tempo = module[25];
		let playerCalls = 0;
		let repStartPos = 0;
		let repEndPos = 0;
		let repTimes = 0;
		const seen = new Uint8Array(85);
		while (pos >= 0 && pos < 85) {
			if (pos == repEndPos && repTimes > 0) {
				for (let i = 0; i < 85; i++)
					if (seen[i] == 1 || seen[i] == 3)
						seen[i] = 0;
				repTimes--;
				pos = repStartPos;
			}
			if (seen[pos] != 0) {
				if (seen[pos] != 1)
					this.#loops[this.#songs] = true;
				break;
			}
			seen[pos] = 1;
			let p1 = module[518 + pos];
			let p2 = module[603 + pos];
			let p3 = module[688 + pos];
			if (p1 == 254 || p2 == 254 || p3 == 254) {
				pos++;
				continue;
			}
			p1 |= this.type == ASAPModuleType.CMS ? 7 : 15;
			switch (p1) {
			case 135:
			case 167:
				pos++;
				break;
			case 143:
				pos = -1;
				break;
			case 151:
				if (p2 < 128) {
					playerCalls += p2;
					if (p3 < 128)
						playerCalls += p3 * 50;
				}
				pos++;
				break;
			case 159:
				pos = p2;
				break;
			case 175:
				pos -= p2;
				break;
			case 191:
				pos += p2;
				break;
			case 207:
				if (p2 < 128) {
					tempo = p2;
					pos++;
				}
				else
					pos = -1;
				break;
			case 223:
				pos++;
				repStartPos = pos;
				repEndPos = pos + p2;
				repTimes = p3 - 1;
				break;
			case 239:
				this.#loops[this.#songs] = true;
				pos = -1;
				break;
			default:
				p2 = repTimes > 0 ? 3 : 2;
				for (p1 = 0; p1 < 85; p1++)
					if (seen[p1] == 1)
						seen[p1] = p2;
				playerCalls += tempo * (this.type == ASAPModuleType.CM3 ? 48 : 64);
				pos++;
				break;
			}
		}
		this.#addSong(playerCalls);
	}

	#parseCmc(module, moduleLen, type)
	{
		if (moduleLen < 774)
			throw new ASAPFormatException("Module too short");
		this.type = type;
		this.#parseModule(module, moduleLen);
		let lastPos = 84;
		while (--lastPos >= 0) {
			if (module[518 + lastPos] < 176 || module[603 + lastPos] < 64 || module[688 + lastPos] < 64)
				break;
			if (this.#channels == 2) {
				if (module[774 + lastPos] < 176 || module[859 + lastPos] < 64 || module[944 + lastPos] < 64)
					break;
			}
		}
		this.#songs = 0;
		this.#parseCmcSong(module, 0);
		for (let pos = 0; pos < lastPos && this.#songs < 32; pos++)
			if (module[518 + pos] == 143 || module[518 + pos] == 239)
				this.#parseCmcSong(module, pos + 1);
	}

	static #isDltTrackEmpty(module, pos)
	{
		return module[8198 + pos] >= 67 && module[8454 + pos] >= 64 && module[8710 + pos] >= 64 && module[8966 + pos] >= 64;
	}

	static #isDltPatternEnd(module, pos, i)
	{
		for (let ch = 0; ch < 4; ch++) {
			let pattern = module[8198 + (ch << 8) + pos];
			if (pattern < 64) {
				let offset = 6 + (pattern << 7) + (i << 1);
				if ((module[offset] & 128) == 0 && (module[offset + 1] & 128) != 0)
					return true;
			}
		}
		return false;
	}

	#parseDltSong(module, seen, pos)
	{
		while (pos < 128 && !seen[pos] && ASAPInfo.#isDltTrackEmpty(module, pos))
			seen[pos++] = true;
		this.songPos[this.#songs] = pos;
		let playerCalls = 0;
		let loop = false;
		let tempo = 6;
		while (pos < 128) {
			if (seen[pos]) {
				loop = true;
				break;
			}
			seen[pos] = true;
			let p1 = module[8198 + pos];
			if (p1 == 64 || ASAPInfo.#isDltTrackEmpty(module, pos))
				break;
			if (p1 == 65)
				pos = module[8326 + pos];
			else if (p1 == 66)
				tempo = module[8326 + pos++];
			else {
				for (let i = 0; i < 64 && !ASAPInfo.#isDltPatternEnd(module, pos, i); i++)
					playerCalls += tempo;
				pos++;
			}
		}
		if (playerCalls > 0) {
			this.#loops[this.#songs] = loop;
			this.#addSong(playerCalls);
		}
	}

	#parseDlt(module, moduleLen)
	{
		if (moduleLen != 11270 && moduleLen != 11271)
			throw new ASAPFormatException("Invalid module length");
		this.type = ASAPModuleType.DLT;
		this.#parseModule(module, moduleLen);
		if (this.#music != 8192)
			throw new ASAPFormatException("Unsupported module address");
		const seen = new Array(128);
		this.#songs = 0;
		for (let pos = 0; pos < 128 && this.#songs < 32; pos++) {
			if (!seen[pos])
				this.#parseDltSong(module, seen, pos);
		}
		if (this.#songs == 0)
			throw new ASAPFormatException("No songs found");
	}

	#parseMptSong(module, globalSeen, songLen, pos)
	{
		let addrToOffset = ASAPInfo.getWord(module, 2) - 6;
		let tempo = module[463];
		let playerCalls = 0;
		const seen = new Uint8Array(256);
		const patternOffset = new Int32Array(4);
		const blankRows = new Int32Array(4);
		const blankRowsCounter = new Int32Array(4);
		while (pos < songLen) {
			if (seen[pos] != 0) {
				if (seen[pos] != 1)
					this.#loops[this.#songs] = true;
				break;
			}
			seen[pos] = 1;
			globalSeen[pos] = true;
			let i = module[464 + pos * 2];
			if (i == 255) {
				pos = module[465 + pos * 2];
				continue;
			}
			let ch;
			for (ch = 3; ch >= 0; ch--) {
				i = module[454 + ch] + (module[458 + ch] << 8) - addrToOffset;
				i = module[i + pos * 2];
				if (i >= 64)
					break;
				i <<= 1;
				i = ASAPInfo.getWord(module, 70 + i);
				patternOffset[ch] = i == 0 ? 0 : i - addrToOffset;
				blankRowsCounter[ch] = 0;
			}
			if (ch >= 0)
				break;
			for (i = 0; i < songLen; i++)
				if (seen[i] == 1)
					seen[i] = 2;
			for (let patternRows = module[462]; --patternRows >= 0;) {
				for (ch = 3; ch >= 0; ch--) {
					if (patternOffset[ch] == 0)
						continue;
					if (--blankRowsCounter[ch] >= 0)
						continue;
					for (;;) {
						i = module[patternOffset[ch]++];
						if (i < 64 || i == 254)
							break;
						if (i < 128)
							continue;
						if (i < 192) {
							blankRows[ch] = i - 128;
							continue;
						}
						if (i < 208)
							continue;
						if (i < 224) {
							tempo = i - 207;
							continue;
						}
						patternRows = 0;
					}
					blankRowsCounter[ch] = blankRows[ch];
				}
				playerCalls += tempo;
			}
			pos++;
		}
		if (playerCalls > 0)
			this.#addSong(playerCalls);
	}

	#parseMpt(module, moduleLen)
	{
		if (moduleLen < 464)
			throw new ASAPFormatException("Module too short");
		this.type = ASAPModuleType.MPT;
		this.#parseModule(module, moduleLen);
		let track0Addr = ASAPInfo.getWord(module, 2) + 458;
		if (module[454] + (module[458] << 8) != track0Addr)
			throw new ASAPFormatException("Invalid address of the first track");
		let songLen = (module[455] + (module[459] << 8) - track0Addr) >> 1;
		if (songLen > 254)
			throw new ASAPFormatException("Song too long");
		const globalSeen = new Array(256);
		this.#songs = 0;
		for (let pos = 0; pos < songLen && this.#songs < 32; pos++) {
			if (!globalSeen[pos]) {
				this.songPos[this.#songs] = pos;
				this.#parseMptSong(module, globalSeen, songLen, pos);
			}
		}
		if (this.#songs == 0)
			throw new ASAPFormatException("No songs found");
	}

	static #getRmtInstrumentFrames(module, instrument, volume, volumeFrame, onExtraPokey)
	{
		let addrToOffset = ASAPInfo.getWord(module, 2) - 6;
		instrument = ASAPInfo.getWord(module, 14) - addrToOffset + (instrument << 1);
		if (module[instrument + 1] == 0)
			return 0;
		instrument = ASAPInfo.getWord(module, instrument) - addrToOffset;
		let perFrame = module[12];
		let playerCall = volumeFrame * perFrame;
		let playerCalls = playerCall;
		let index = module[instrument] + 1 + playerCall * 3;
		let indexEnd = module[instrument + 2] + 3;
		let indexLoop = module[instrument + 3];
		if (indexLoop >= indexEnd)
			return 0;
		let volumeSlideDepth = module[instrument + 6];
		let volumeMin = module[instrument + 7];
		if (index >= indexEnd)
			index = (index - indexEnd) % (indexEnd - indexLoop) + indexLoop;
		else {
			do {
				let vol = module[instrument + index];
				if (onExtraPokey)
					vol >>= 4;
				if ((vol & 15) >= ASAPInfo.#GET_RMT_INSTRUMENT_FRAMES_RMT_VOLUME_SILENT[volume])
					playerCalls = playerCall + 1;
				playerCall++;
				index += 3;
			}
			while (index < indexEnd);
		}
		if (volumeSlideDepth == 0)
			return playerCalls / perFrame | 0;
		let volumeSlide = 128;
		let silentLoop = false;
		for (;;) {
			if (index >= indexEnd) {
				if (silentLoop)
					break;
				silentLoop = true;
				index = indexLoop;
			}
			let vol = module[instrument + index];
			if (onExtraPokey)
				vol >>= 4;
			if ((vol & 15) >= ASAPInfo.#GET_RMT_INSTRUMENT_FRAMES_RMT_VOLUME_SILENT[volume]) {
				playerCalls = playerCall + 1;
				silentLoop = false;
			}
			playerCall++;
			index += 3;
			volumeSlide -= volumeSlideDepth;
			if (volumeSlide < 0) {
				volumeSlide += 256;
				if (--volume <= volumeMin)
					break;
			}
		}
		return playerCalls / perFrame | 0;
	}

	#parseRmtSong(module, globalSeen, songLen, posShift, pos)
	{
		let addrToOffset = ASAPInfo.getWord(module, 2) - 6;
		let tempo = module[11];
		let frames = 0;
		let songOffset = ASAPInfo.getWord(module, 20) - addrToOffset;
		let patternLoOffset = ASAPInfo.getWord(module, 16) - addrToOffset;
		let patternHiOffset = ASAPInfo.getWord(module, 18) - addrToOffset;
		const seen = new Uint8Array(256);
		const patternBegin = new Int32Array(8);
		const patternOffset = new Int32Array(8);
		const blankRows = new Int32Array(8);
		const instrumentNo = new Int32Array(8);
		const instrumentFrame = new Int32Array(8);
		const volumeValue = new Int32Array(8);
		const volumeFrame = new Int32Array(8);
		while (pos < songLen) {
			if (seen[pos] != 0) {
				if (seen[pos] != 1)
					this.#loops[this.#songs] = true;
				break;
			}
			seen[pos] = 1;
			globalSeen[pos] = true;
			if (module[songOffset + (pos << posShift)] == 254) {
				pos = module[songOffset + (pos << posShift) + 1];
				continue;
			}
			for (let ch = 0; ch < 1 << posShift; ch++) {
				let p = module[songOffset + (pos << posShift) + ch];
				if (p == 255)
					blankRows[ch] = 256;
				else {
					patternOffset[ch] = patternBegin[ch] = module[patternLoOffset + p] + (module[patternHiOffset + p] << 8) - addrToOffset;
					if (patternOffset[ch] < 0)
						return;
					blankRows[ch] = 0;
				}
			}
			for (let i = 0; i < songLen; i++)
				if (seen[i] == 1)
					seen[i] = 2;
			for (let patternRows = module[10]; --patternRows >= 0;) {
				for (let ch = 0; ch < 1 << posShift; ch++) {
					if (--blankRows[ch] > 0)
						continue;
					for (;;) {
						let i = module[patternOffset[ch]++];
						if ((i & 63) < 62) {
							i += module[patternOffset[ch]++] << 8;
							if ((i & 63) != 61) {
								instrumentNo[ch] = i >> 10;
								instrumentFrame[ch] = frames;
							}
							volumeValue[ch] = i >> 6 & 15;
							volumeFrame[ch] = frames;
							break;
						}
						if (i == 62) {
							blankRows[ch] = module[patternOffset[ch]++];
							break;
						}
						if ((i & 63) == 62) {
							blankRows[ch] = i >> 6;
							break;
						}
						if ((i & 191) == 63) {
							tempo = module[patternOffset[ch]++];
							continue;
						}
						if (i == 191) {
							patternOffset[ch] = patternBegin[ch] + module[patternOffset[ch]];
							continue;
						}
						patternRows = -1;
						break;
					}
					if (patternRows < 0)
						break;
				}
				if (patternRows >= 0)
					frames += tempo;
			}
			pos++;
		}
		let instrumentFrames = 0;
		for (let ch = 0; ch < 1 << posShift; ch++) {
			let frame = instrumentFrame[ch];
			frame += ASAPInfo.#getRmtInstrumentFrames(module, instrumentNo[ch], volumeValue[ch], volumeFrame[ch] - frame, ch >= 4);
			if (instrumentFrames < frame)
				instrumentFrames = frame;
		}
		if (frames > instrumentFrames) {
			if (frames - instrumentFrames > 100)
				this.#loops[this.#songs] = false;
			frames = instrumentFrames;
		}
		if (frames > 0)
			this.#addSong(frames);
	}

	static #validateRmt(module, moduleLen)
	{
		if (moduleLen < 48)
			return false;
		if (module[6] != 82 || module[7] != 77 || module[8] != 84 || module[13] != 1)
			return false;
		return true;
	}

	#parseRmt(module, moduleLen)
	{
		if (!ASAPInfo.#validateRmt(module, moduleLen))
			throw new ASAPFormatException("Invalid RMT file");
		let posShift;
		switch (module[9]) {
		case 52:
			posShift = 2;
			break;
		case 56:
			this.#channels = 2;
			posShift = 3;
			break;
		default:
			throw new ASAPFormatException("Unsupported number of channels");
		}
		let perFrame = module[12];
		if (perFrame < 1 || perFrame > 4)
			throw new ASAPFormatException("Unsupported player call rate");
		this.type = ASAPModuleType.RMT;
		this.#parseModule(module, moduleLen);
		let blockLen = ASAPInfo.getWord(module, 4) + 1 - this.#music;
		let songLen = ASAPInfo.getWord(module, 4) + 1 - ASAPInfo.getWord(module, 20);
		if (posShift == 3 && (songLen & 4) != 0 && module[6 + blockLen - 4] == 254)
			songLen += 4;
		songLen >>= posShift;
		if (songLen >= 256)
			throw new ASAPFormatException("Song too long");
		const globalSeen = new Array(256);
		this.#songs = 0;
		for (let pos = 0; pos < songLen && this.#songs < 32; pos++) {
			if (!globalSeen[pos]) {
				this.songPos[this.#songs] = pos;
				this.#parseRmtSong(module, globalSeen, songLen, posShift, pos);
			}
		}
		this.#fastplay = 312 / perFrame | 0;
		this.player = 1536;
		if (this.#songs == 0)
			throw new ASAPFormatException("No songs found");
		const title = new Uint8Array(127);
		let titleLen;
		for (titleLen = 0; titleLen < 127 && 10 + blockLen + titleLen < moduleLen; titleLen++) {
			let c = module[10 + blockLen + titleLen];
			if (c == 0)
				break;
			title[titleLen] = ASAPInfo.#isValidChar(c) ? c : 32;
		}
		this.#title = new TextDecoder().decode(title.subarray(0, titleLen));
	}

	#parseTmcSong(module, pos)
	{
		let addrToOffset = ASAPInfo.getWord(module, 2) - 6;
		let tempo = module[36] + 1;
		let frames = 0;
		const patternOffset = new Int32Array(8);
		const blankRows = new Int32Array(8);
		while (module[437 + pos] < 128) {
			for (let ch = 7; ch >= 0; ch--) {
				let pat = module[437 + pos - 2 * ch];
				patternOffset[ch] = module[166 + pat] + (module[294 + pat] << 8) - addrToOffset;
				blankRows[ch] = 0;
			}
			for (let patternRows = 64; --patternRows >= 0;) {
				for (let ch = 7; ch >= 0; ch--) {
					if (--blankRows[ch] >= 0)
						continue;
					for (;;) {
						let i = module[patternOffset[ch]++];
						if (i < 64) {
							patternOffset[ch]++;
							break;
						}
						if (i == 64) {
							i = module[patternOffset[ch]++];
							if ((i & 127) == 0)
								patternRows = 0;
							else
								tempo = (i & 127) + 1;
							if (i >= 128)
								patternOffset[ch]++;
							break;
						}
						if (i < 128) {
							i = module[patternOffset[ch]++] & 127;
							if (i == 0)
								patternRows = 0;
							else
								tempo = i + 1;
							patternOffset[ch]++;
							break;
						}
						if (i < 192)
							continue;
						blankRows[ch] = i - 191;
						break;
					}
				}
				frames += tempo;
			}
			pos += 16;
		}
		if (module[436 + pos] < 128)
			this.#loops[this.#songs] = true;
		this.#addSong(frames);
	}

	static #parseTmcTitle(title, titleLen, module, moduleOffset)
	{
		let lastOffset = moduleOffset + 29;
		while (module[lastOffset] == 32) {
			if (--lastOffset < moduleOffset)
				return titleLen;
		}
		if (titleLen > 0) {
			title[titleLen++] = 32;
			title[titleLen++] = 124;
			title[titleLen++] = 32;
		}
		while (moduleOffset <= lastOffset) {
			let c = module[moduleOffset++] & 127;
			switch (c) {
			case 20:
				c = 42;
				break;
			case 1:
			case 3:
			case 5:
			case 12:
			case 14:
			case 15:
			case 19:
				c += 96;
				break;
			case 24:
			case 26:
				c = 122;
				break;
			default:
				if (!ASAPInfo.#isValidChar(c))
					c = 32;
				break;
			}
			title[titleLen++] = c;
		}
		return titleLen;
	}

	#parseTmc(module, moduleLen)
	{
		if (moduleLen < 464)
			throw new ASAPFormatException("Module too short");
		this.type = ASAPModuleType.TMC;
		this.#parseModule(module, moduleLen);
		this.#channels = 2;
		let i = 0;
		while (module[102 + i] == 0) {
			if (++i >= 64)
				throw new ASAPFormatException("No instruments");
		}
		let lastPos = (module[102 + i] << 8) + module[38 + i] - ASAPInfo.getWord(module, 2) - 432;
		if (437 + lastPos >= moduleLen)
			throw new ASAPFormatException("Module too short");
		do {
			if (lastPos <= 0)
				throw new ASAPFormatException("No songs found");
			lastPos -= 16;
		}
		while (module[437 + lastPos] >= 128);
		this.#songs = 0;
		this.#parseTmcSong(module, 0);
		for (i = 0; i < lastPos && this.#songs < 32; i += 16)
			if (module[437 + i] >= 128)
				this.#parseTmcSong(module, i + 16);
		i = module[37];
		if (i < 1 || i > 4)
			throw new ASAPFormatException("Unsupported player call rate");
		this.#fastplay = 312 / i | 0;
		const title = new Uint8Array(127);
		let titleLen = ASAPInfo.#parseTmcTitle(title, 0, module, 6);
		this.#title = new TextDecoder().decode(title.subarray(0, titleLen));
	}

	#parseTm2Song(module, pos)
	{
		let addrToOffset = ASAPInfo.getWord(module, 2) - 6;
		let tempo = module[36] + 1;
		let playerCalls = 0;
		const patternOffset = new Int32Array(8);
		const blankRows = new Int32Array(8);
		for (;;) {
			let patternRows = module[918 + pos];
			if (patternRows == 0)
				break;
			if (patternRows >= 128) {
				this.#loops[this.#songs] = true;
				break;
			}
			for (let ch = 7; ch >= 0; ch--) {
				let pat = module[917 + pos - 2 * ch];
				patternOffset[ch] = module[262 + pat] + (module[518 + pat] << 8) - addrToOffset;
				blankRows[ch] = 0;
			}
			while (--patternRows >= 0) {
				for (let ch = 7; ch >= 0; ch--) {
					if (--blankRows[ch] >= 0)
						continue;
					for (;;) {
						let i = module[patternOffset[ch]++];
						if (i == 0) {
							patternOffset[ch]++;
							break;
						}
						if (i < 64) {
							if (module[patternOffset[ch]++] >= 128)
								patternOffset[ch]++;
							break;
						}
						if (i < 128) {
							patternOffset[ch]++;
							break;
						}
						if (i == 128) {
							blankRows[ch] = module[patternOffset[ch]++];
							break;
						}
						if (i < 192)
							break;
						if (i < 208) {
							tempo = i - 191;
							continue;
						}
						if (i < 224) {
							patternOffset[ch]++;
							break;
						}
						if (i < 240) {
							patternOffset[ch] += 2;
							break;
						}
						if (i < 255) {
							blankRows[ch] = i - 240;
							break;
						}
						blankRows[ch] = 64;
						break;
					}
				}
				playerCalls += tempo;
			}
			pos += 17;
		}
		this.#addSong(playerCalls);
	}

	#parseTm2(module, moduleLen)
	{
		if (moduleLen < 932)
			throw new ASAPFormatException("Module too short");
		this.type = ASAPModuleType.TM2;
		this.#parseModule(module, moduleLen);
		let i = module[37];
		if (i < 1 || i > 4)
			throw new ASAPFormatException("Unsupported player call rate");
		this.#fastplay = 312 / i | 0;
		this.player = 2048;
		if (module[31] != 0)
			this.#channels = 2;
		let lastPos = 65535;
		for (i = 0; i < 128; i++) {
			let instrAddr = module[134 + i] + (module[774 + i] << 8);
			if (instrAddr != 0 && instrAddr < lastPos)
				lastPos = instrAddr;
		}
		for (i = 0; i < 256; i++) {
			let patternAddr = module[262 + i] + (module[518 + i] << 8);
			if (patternAddr != 0 && patternAddr < lastPos)
				lastPos = patternAddr;
		}
		lastPos -= ASAPInfo.getWord(module, 2) + 896;
		if (902 + lastPos >= moduleLen)
			throw new ASAPFormatException("Module too short");
		let c;
		do {
			if (lastPos <= 0)
				throw new ASAPFormatException("No songs found");
			lastPos -= 17;
			c = module[918 + lastPos];
		}
		while (c == 0 || c >= 128);
		this.#songs = 0;
		this.#parseTm2Song(module, 0);
		for (i = 0; i < lastPos && this.#songs < 32; i += 17) {
			c = module[918 + i];
			if (c == 0 || c >= 128)
				this.#parseTm2Song(module, i + 17);
		}
		const title = new Uint8Array(127);
		let titleLen = ASAPInfo.#parseTmcTitle(title, 0, module, 39);
		titleLen = ASAPInfo.#parseTmcTitle(title, titleLen, module, 71);
		titleLen = ASAPInfo.#parseTmcTitle(title, titleLen, module, 103);
		this.#title = new TextDecoder().decode(title.subarray(0, titleLen));
	}

	static #afterFF(module, moduleLen, currentOffset)
	{
		while (currentOffset < moduleLen) {
			if (module[currentOffset++] == 255)
				return currentOffset;
		}
		throw new ASAPFormatException("Module too short");
	}

	static #getFcTrackCommand(module, trackPos, n)
	{
		return module[3 + (n << 8) + trackPos[n]];
	}

	static #isFcSongEnd(module, trackPos)
	{
		let allLoop = true;
		for (let n = 0; n < 3; n++) {
			if (trackPos[n] >= 256)
				return true;
			switch (ASAPInfo.#getFcTrackCommand(module, trackPos, n)) {
			case 254:
				return true;
			case 255:
				break;
			default:
				allLoop = false;
				break;
			}
		}
		return allLoop;
	}

	static #validateFc(module, moduleLen)
	{
		if (moduleLen < 899)
			return false;
		if (module[0] != 38 || module[1] != 35)
			return false;
		return true;
	}

	#parseFc(module, moduleLen)
	{
		if (!ASAPInfo.#validateFc(module, moduleLen))
			throw new ASAPFormatException("Invalid FC file");
		this.type = ASAPModuleType.FC;
		this.player = 1024;
		this.#music = 2560;
		this.#songs = 0;
		this.headerLen = -1;
		const patternOffsets = new Int32Array(64);
		let currentOffset = 899;
		for (let i = 0; i < 64; i++) {
			patternOffsets[i] = currentOffset;
			currentOffset = ASAPInfo.#afterFF(module, moduleLen, currentOffset);
		}
		for (let i = 0; i < 32; i++)
			currentOffset = ASAPInfo.#afterFF(module, moduleLen, currentOffset);
		for (let pos = 0; pos < 256 && this.#songs < 32;) {
			const trackPos = new Int32Array(3);
			for (let n = 0; n < 3; n++)
				trackPos[n] = pos;
			const patternDelay = new Int32Array(3);
			const noteDuration = new Int32Array(3);
			const patternPos = new Int32Array(3);
			let playerCalls = 0;
			this.#loops[this.#songs] = true;
			while (!ASAPInfo.#isFcSongEnd(module, trackPos)) {
				for (let n = 0; n < 3; n++) {
					if (ASAPInfo.#getFcTrackCommand(module, trackPos, n) == 255)
						continue;
					if (patternDelay[n]-- > 0)
						continue;
					while (trackPos[n] < 256) {
						let trackCmd = ASAPInfo.#getFcTrackCommand(module, trackPos, n);
						if (trackCmd < 64) {
							let patternCmd = module[patternOffsets[trackCmd] + patternPos[n]++];
							if (patternCmd < 64) {
								patternDelay[n] = noteDuration[n];
								break;
							}
							else if (patternCmd < 96)
								noteDuration[n] = patternCmd - 64;
							else if (patternCmd == 255) {
								patternDelay[n] = 0;
								noteDuration[n] = 0;
								patternPos[n] = 0;
								trackPos[n]++;
							}
						}
						else if (trackCmd == 64)
							trackPos[n] += 2;
						else if (trackCmd == 254) {
							this.#loops[this.#songs] = false;
							break;
						}
						else if (trackCmd == 255)
							break;
						else
							trackPos[n]++;
					}
				}
				if (ASAPInfo.#isFcSongEnd(module, trackPos))
					break;
				playerCalls += module[2];
			}
			pos = -1;
			for (let n = 0; n < 3; n++) {
				let nxtrkpos = trackPos[n];
				if (patternPos[n] > 0)
					nxtrkpos++;
				if (pos < nxtrkpos)
					pos = nxtrkpos;
			}
			pos++;
			if (pos <= 256)
				this.#addSong(playerCalls);
		}
	}

	static #parseText(module, i, argEnd)
	{
		let len = argEnd - i - 2;
		if (i < 0 || len < 0 || module[i] != 34 || module[argEnd - 1] != 34)
			return "";
		if (len == 3 && module[i + 1] == 60 && module[i + 2] == 63 && module[i + 3] == 62)
			return "";
		return new TextDecoder().decode(module.subarray(i + 1, i + 1 + len));
	}

	static #hasStringAt(module, moduleIndex, s)
	{
		for (const c of s)
			if (c.codePointAt(0) != module[moduleIndex++])
				return false;
		return true;
	}

	static #parseDec(module, i, argEnd, minVal, maxVal)
	{
		if (i < 0)
			throw new ASAPFormatException("Missing number");
		let r = 0;
		while (i < argEnd) {
			let c = module[i++];
			if (c < 48 || c > 57)
				throw new ASAPFormatException("Invalid number");
			r = r * 10 + c - 48;
			if (r > maxVal)
				throw new ASAPFormatException("Number too big");
		}
		if (r < minVal)
			throw new ASAPFormatException("Number too small");
		return r;
	}

	static #parseHex(module, i, argEnd)
	{
		if (i < 0)
			throw new ASAPFormatException("Missing number");
		let r = 0;
		while (i < argEnd) {
			let c = module[i++];
			if (r > 4095)
				throw new ASAPFormatException("Number too big");
			r <<= 4;
			if (c >= 48 && c <= 57)
				r += c - 48;
			else if (c >= 65 && c <= 70)
				r += c - 65 + 10;
			else if (c >= 97 && c <= 102)
				r += c - 97 + 10;
			else
				throw new ASAPFormatException("Invalid number");
		}
		return r;
	}

	/**
	 * Returns the number of milliseconds represented by the given string.
	 * @param s Time in the <code>"mm:ss.xxx"</code> format.
	 */
	static parseDuration(s)
	{
		const parser = new DurationParser();
		return parser.parse(s);
	}

	static #validateSap(module, moduleLen)
	{
		return moduleLen >= 30 && ASAPInfo.#hasStringAt(module, 0, "SAP\r\n");
	}

	#parseSap(module, moduleLen)
	{
		if (!ASAPInfo.#validateSap(module, moduleLen))
			throw new ASAPFormatException("Invalid SAP file");
		this.#fastplay = -1;
		let type = 0;
		let moduleIndex = 5;
		let durationIndex = 0;
		while (module[moduleIndex] != 255) {
			let lineStart = moduleIndex;
			while (module[moduleIndex] > 32) {
				if (++moduleIndex >= moduleLen)
					throw new ASAPFormatException("Invalid SAP file");
			}
			let tagLen = moduleIndex - lineStart;
			let argStart = -1;
			let argEnd = -1;
			for (;;) {
				let c = module[moduleIndex];
				if (c > 32) {
					if (!ASAPInfo.#isValidChar(c))
						throw new ASAPFormatException("Invalid character");
					if (argStart < 0)
						argStart = moduleIndex;
					argEnd = -1;
				}
				else {
					if (argEnd < 0)
						argEnd = moduleIndex;
					if (c == 10)
						break;
				}
				if (++moduleIndex >= moduleLen)
					throw new ASAPFormatException("Invalid SAP file");
			}
			if (++moduleIndex + 6 >= moduleLen)
				throw new ASAPFormatException("Invalid SAP file");
			switch (new TextDecoder().decode(module.subarray(lineStart, lineStart + tagLen))) {
			case "AUTHOR":
				this.#author = ASAPInfo.#parseText(module, argStart, argEnd);
				break;
			case "NAME":
				this.#title = ASAPInfo.#parseText(module, argStart, argEnd);
				break;
			case "DATE":
				this.#date = ASAPInfo.#parseText(module, argStart, argEnd);
				break;
			case "TIME":
				if (durationIndex >= 32)
					throw new ASAPFormatException("Too many TIME tags");
				if (argStart < 0)
					throw new ASAPFormatException("Missing TIME argument");
				if (argEnd - argStart > 5 && ASAPInfo.#hasStringAt(module, argEnd - 5, " LOOP")) {
					this.#loops[durationIndex] = true;
					argEnd -= 5;
				}
				{
					let arg = new TextDecoder().decode(module.subarray(argStart, argStart + argEnd - argStart));
					this.#durations[durationIndex++] = ASAPInfo.parseDuration(arg);
				}
				break;
			case "SONGS":
				this.#songs = ASAPInfo.#parseDec(module, argStart, argEnd, 1, 32);
				break;
			case "DEFSONG":
				this.#defaultSong = ASAPInfo.#parseDec(module, argStart, argEnd, 0, 31);
				break;
			case "TYPE":
				if (argStart < 0)
					throw new ASAPFormatException("Missing TYPE argument");
				type = module[argStart];
				break;
			case "FASTPLAY":
				this.#fastplay = ASAPInfo.#parseDec(module, argStart, argEnd, 1, 32767);
				break;
			case "MUSIC":
				this.#music = ASAPInfo.#parseHex(module, argStart, argEnd);
				break;
			case "INIT":
				this.#init = ASAPInfo.#parseHex(module, argStart, argEnd);
				break;
			case "PLAYER":
				this.player = ASAPInfo.#parseHex(module, argStart, argEnd);
				break;
			case "COVOX":
				this.#covoxAddr = ASAPInfo.#parseHex(module, argStart, argEnd);
				if (this.#covoxAddr != 54784)
					throw new ASAPFormatException("COVOX should be D600");
				this.#channels = 2;
				break;
			case "STEREO":
				this.#channels = 2;
				break;
			case "NTSC":
				this.#ntsc = true;
				break;
			default:
				break;
			}
		}
		if (this.#defaultSong >= this.#songs)
			throw new ASAPFormatException("DEFSONG too big");
		switch (type) {
		case 66:
			if (this.player < 0)
				throw new ASAPFormatException("Missing PLAYER tag");
			if (this.#init < 0)
				throw new ASAPFormatException("Missing INIT tag");
			this.type = ASAPModuleType.SAP_B;
			break;
		case 67:
			if (this.player < 0)
				throw new ASAPFormatException("Missing PLAYER tag");
			if (this.#music < 0)
				throw new ASAPFormatException("Missing MUSIC tag");
			this.type = ASAPModuleType.SAP_C;
			break;
		case 68:
			if (this.#init < 0)
				throw new ASAPFormatException("Missing INIT tag");
			this.type = ASAPModuleType.SAP_D;
			break;
		case 83:
			if (this.#init < 0)
				throw new ASAPFormatException("Missing INIT tag");
			this.type = ASAPModuleType.SAP_S;
			if (this.#fastplay < 0)
				this.#fastplay = 78;
			break;
		default:
			throw new ASAPFormatException("Unsupported TYPE");
		}
		if (this.#fastplay < 0)
			this.#fastplay = this.#ntsc ? 262 : 312;
		if (module[moduleIndex + 1] != 255)
			throw new ASAPFormatException("Invalid binary header");
		this.headerLen = moduleIndex;
	}

	static packExt(ext)
	{
		return ext.length == 2 && ext.charCodeAt(0) <= 122 && ext.charCodeAt(1) <= 122 ? ext.charCodeAt(0) | ext.charCodeAt(1) << 8 | 2105376 : ext.length == 3 && ext.charCodeAt(0) <= 122 && ext.charCodeAt(1) <= 122 && ext.charCodeAt(2) <= 122 ? ext.charCodeAt(0) | ext.charCodeAt(1) << 8 | ext.charCodeAt(2) << 16 | 2105376 : 0;
	}

	static getPackedExt(filename)
	{
		let ext = 0;
		for (let i = filename.length; --i > 0;) {
			let c = filename.charCodeAt(i);
			if (c <= 32 || c > 122)
				return 0;
			if (c == 46)
				return ext | 2105376;
			ext = (ext << 8) + c;
		}
		return 0;
	}

	static #isOurPackedExt(ext)
	{
		switch (ext) {
		case 7364979:
		case 6516067:
		case 3370339:
		case 7499107:
		case 7564643:
		case 6516068:
		case 7629924:
		case 7630957:
		case 6582381:
		case 7630194:
		case 6516084:
		case 3698036:
		case 3304820:
		case 2122598:
			return true;
		default:
			return false;
		}
	}

	/**
	 * Checks whether the filename represents a module type supported by ASAP.
	 * Returns <code>true</code> if the filename is supported by ASAP.
	 * @param filename Filename to check the extension of.
	 */
	static isOurFile(filename)
	{
		return ASAPInfo.#isOurPackedExt(ASAPInfo.getPackedExt(filename));
	}

	/**
	 * Checks whether the filename extension represents a module type supported by ASAP.
	 * Returns <code>true</code> if the filename extension is supported by ASAP.
	 * @param ext Filename extension without the leading dot.
	 */
	static isOurExt(ext)
	{
		return ASAPInfo.#isOurPackedExt(ASAPInfo.packExt(ext));
	}

	static #guessPackedExt(module, moduleLen)
	{
		if (ASAPInfo.#validateSap(module, moduleLen))
			return 7364979;
		if (ASAPInfo.#validateFc(module, moduleLen))
			return 2122598;
		if (ASAPInfo.#validateRmt(module, moduleLen))
			return 7630194;
		throw new ASAPFormatException("Unknown format");
	}

	/**
	 * Loads file information.
	 * @param filename Filename, used to determine the format.
	 * @param module Contents of the file.
	 * @param moduleLen Length of the file.
	 */
	load(filename, module, moduleLen)
	{
		let ext;
		if (filename != null) {
			let len = filename.length;
			let basename = 0;
			ext = -1;
			for (let i = len; --i >= 0;) {
				let c = filename.charCodeAt(i);
				if (c == 47 || c == 92) {
					basename = i + 1;
					break;
				}
				if (c == 46)
					ext = i;
			}
			if (ext < 0)
				throw new ASAPFormatException("Filename has no extension");
			ext -= basename;
			if (ext > 127)
				ext = 127;
			this.#filename = filename.substring(basename, basename + ext);
			ext = ASAPInfo.getPackedExt(filename);
		}
		else {
			this.#filename = "";
			ext = ASAPInfo.#guessPackedExt(module, moduleLen);
		}
		this.#author = "";
		this.#title = "";
		this.#date = "";
		this.#channels = 1;
		this.#songs = 1;
		this.#defaultSong = 0;
		for (let i = 0; i < 32; i++) {
			this.#durations[i] = -1;
			this.#loops[i] = false;
		}
		this.#ntsc = false;
		this.#fastplay = 312;
		this.#music = -1;
		this.#init = -1;
		this.player = -1;
		this.#covoxAddr = -1;
		this.headerLen = 0;
		switch (ext) {
		case 7364979:
			this.#parseSap(module, moduleLen);
			return;
		case 6516067:
			this.#parseCmc(module, moduleLen, ASAPModuleType.CMC);
			return;
		case 3370339:
			this.#parseCmc(module, moduleLen, ASAPModuleType.CM3);
			return;
		case 7499107:
			this.#parseCmc(module, moduleLen, ASAPModuleType.CMR);
			return;
		case 7564643:
			this.#channels = 2;
			this.#parseCmc(module, moduleLen, ASAPModuleType.CMS);
			return;
		case 6516068:
			this.#fastplay = 156;
			this.#parseCmc(module, moduleLen, ASAPModuleType.CMC);
			return;
		case 7629924:
			this.#parseDlt(module, moduleLen);
			return;
		case 7630957:
			this.#parseMpt(module, moduleLen);
			return;
		case 6582381:
			this.#fastplay = 156;
			this.#parseMpt(module, moduleLen);
			return;
		case 7630194:
			this.#parseRmt(module, moduleLen);
			return;
		case 6516084:
		case 3698036:
			this.#parseTmc(module, moduleLen);
			return;
		case 3304820:
			this.#parseTm2(module, moduleLen);
			return;
		case 2122598:
			this.#parseFc(module, moduleLen);
			return;
		default:
			throw new ASAPFormatException("Unknown filename extension");
		}
	}

	static #checkValidText(s)
	{
		if (s.length > 127)
			throw new ASAPArgumentException("Text too long");
		for (const c of s)
			if (!ASAPInfo.#isValidChar(c.codePointAt(0)))
				throw new ASAPArgumentException("Invalid character");
	}

	/**
	 * Returns author's name.
	 * A nickname may be included in parentheses after the real name.
	 * Multiple authors are separated with <code>" &amp; "</code>.
	 * An empty string means the author is unknown.
	 */
	getAuthor()
	{
		return this.#author;
	}

	/**
	 * Sets author's name.
	 * A nickname may be included in parentheses after the real name.
	 * Multiple authors are separated with <code>" &amp; "</code>.
	 * An empty string means the author is unknown.
	 * @param value New author's name for the current music.
	 */
	setAuthor(value)
	{
		ASAPInfo.#checkValidText(value);
		this.#author = value;
	}

	/**
	 * Returns music title.
	 * An empty string means the title is unknown.
	 */
	getTitle()
	{
		return this.#title;
	}

	/**
	 * Sets music title.
	 * An empty string means the title is unknown.
	 * @param value New title for the current music.
	 */
	setTitle(value)
	{
		ASAPInfo.#checkValidText(value);
		this.#title = value;
	}

	/**
	 * Returns music title or filename.
	 * If title is unknown returns filename without the path or extension.
	 */
	getTitleOrFilename()
	{
		return this.#title.length > 0 ? this.#title : this.#filename;
	}

	/**
	 * Returns music creation date.
	 * 
	 * <p>Some of the possible formats are:
	 * <ul>
	 * <li>YYYY</li>
	 * <li>MM/YYYY</li>
	 * <li>DD/MM/YYYY</li>
	 * <li>YYYY-YYYY</li>
	 * </ul>
	 * <p>An empty string means the date is unknown.
	 */
	getDate()
	{
		return this.#date;
	}

	/**
	 * Sets music creation date.
	 * 
	 * <p>Some of the possible formats are:
	 * <ul>
	 * <li>YYYY</li>
	 * <li>MM/YYYY</li>
	 * <li>DD/MM/YYYY</li>
	 * <li>YYYY-YYYY</li>
	 * </ul>
	 * <p>An empty string means the date is unknown.
	 * @param value New music creation date.
	 */
	setDate(value)
	{
		ASAPInfo.#checkValidText(value);
		this.#date = value;
	}

	#checkDate()
	{
		let n = this.#date.length;
		switch (n) {
		case 4:
		case 7:
		case 10:
			break;
		default:
			return -1;
		}
		for (let i = 0; i < n; i++) {
			let c = this.#date.charCodeAt(i);
			if (i == n - 5 || i == n - 8) {
				if (c != 47)
					return -1;
			}
			else if (c < 48 || c > 57)
				return -1;
		}
		return n;
	}

	#getTwoDateDigits(i)
	{
		return (this.#date.charCodeAt(i) - 48) * 10 + this.#date.charCodeAt(i + 1) - 48;
	}

	/**
	 * Returns music creation year.
	 * -1 means the year is unknown.
	 */
	getYear()
	{
		let n = this.#checkDate();
		if (n < 0)
			return -1;
		return this.#getTwoDateDigits(n - 4) * 100 + this.#getTwoDateDigits(n - 2);
	}

	/**
	 * Returns music creation month (1-12).
	 * -1 means the month is unknown.
	 */
	getMonth()
	{
		let n = this.#checkDate();
		if (n < 7)
			return -1;
		return this.#getTwoDateDigits(n - 7);
	}

	/**
	 * Returns day of month of the music creation date.
	 * -1 means the day is unknown.
	 */
	getDayOfMonth()
	{
		let n = this.#checkDate();
		if (n != 10)
			return -1;
		return this.#getTwoDateDigits(0);
	}

	/**
	 * Returns 1 for mono or 2 for stereo.
	 */
	getChannels()
	{
		return this.#channels;
	}

	/**
	 * Returns number of songs in the file.
	 */
	getSongs()
	{
		return this.#songs;
	}

	/**
	 * Returns 0-based index of the "main" song.
	 * The specified song should be played by default.
	 */
	getDefaultSong()
	{
		return this.#defaultSong;
	}

	/**
	 * Sets the 0-based index of the "main" song.
	 * @param song New default song.
	 */
	setDefaultSong(song)
	{
		if (song < 0 || song >= this.#songs)
			throw new ASAPArgumentException("Song out of range");
		this.#defaultSong = song;
	}

	/**
	 * Returns length of the specified song.
	 * The length is specified in milliseconds. -1 means the length is indeterminate.
	 * @param song Song to get length of, 0-based.
	 */
	getDuration(song)
	{
		return this.#durations[song];
	}

	/**
	 * Sets length of the specified song.
	 * The length is specified in milliseconds. -1 means the length is indeterminate.
	 * @param song Song to set length of, 0-based.
	 * @param duration New length in milliseconds.
	 */
	setDuration(song, duration)
	{
		if (song < 0 || song >= this.#songs)
			throw new ASAPArgumentException("Song out of range");
		this.#durations[song] = duration;
	}

	/**
	 * Returns information whether the specified song loops.
	 * 
	 * <p>Returns:
	 * <ul>
	 * <li><code>true</code> if the song loops</li>
	 * <li><code>false</code> if the song stops</li>
	 * </ul>
	 * @param song Song to check for looping, 0-based.
	 */
	getLoop(song)
	{
		return this.#loops[song];
	}

	/**
	 * Sets information whether the specified song loops.
	 * 
	 * <p>Use:
	 * <ul>
	 * <li><code>true</code> if the song loops</li>
	 * <li><code>false</code> if the song stops</li>
	 * </ul>
	 * @param song Song to set as looping, 0-based.
	 * @param loop <code>true</code> if the song loops.
	 */
	setLoop(song, loop)
	{
		if (song < 0 || song >= this.#songs)
			throw new ASAPArgumentException("Song out of range");
		this.#loops[song] = loop;
	}

	/**
	 * Returns <code>true</code> for an NTSC song and <code>false</code> for a PAL song.
	 */
	isNtsc()
	{
		return this.#ntsc;
	}

	/**
	 * Returns <code>true</code> if NTSC can be set or removed.
	 */
	canSetNtsc()
	{
		return this.type == ASAPModuleType.SAP_B && this.#fastplay == (this.#ntsc ? 262 : 312);
	}

	/**
	 * Marks a SAP file as NTSC or PAL.
	 * @param ntsc <code>true</code> for NTSC, <code>false</code> for PAL.
	 */
	setNtsc(ntsc)
	{
		this.#ntsc = ntsc;
		this.#fastplay = ntsc ? 262 : 312;
		for (let song = 0; song < this.#songs; song++) {
			let duration = BigInt(this.#durations[song]);
			if (duration > 0) {
				this.#durations[song] = ntsc ? Number(duration * 5956963n / 7159090n) : Number(duration * 7159090n / 5956963n);
			}
		}
	}

	/**
	 * Returns the letter argument for the TYPE SAP tag.
	 * Returns zero for non-SAP files.
	 */
	getTypeLetter()
	{
		switch (this.type) {
		case ASAPModuleType.SAP_B:
			return 66;
		case ASAPModuleType.SAP_C:
			return 67;
		case ASAPModuleType.SAP_D:
			return 68;
		case ASAPModuleType.SAP_S:
			return 83;
		default:
			return 0;
		}
	}

	/**
	 * Returns player routine rate in Atari scanlines.
	 */
	getPlayerRateScanlines()
	{
		return this.#fastplay;
	}

	/**
	 * Returns approximate player routine rate in Hz.
	 */
	getPlayerRateHz()
	{
		let scanlineClock = this.#ntsc ? 15699 : 15556;
		return (scanlineClock + (this.#fastplay >> 1)) / this.#fastplay | 0;
	}

	/**
	 * Returns the address of the module.
	 * Returns -1 if unknown.
	 */
	getMusicAddress()
	{
		return this.#music;
	}

	/**
	 * Causes music to be relocated.
	 * Use only with <code>ASAPWriter.Write</code>.
	 * @param address New music address.
	 */
	setMusicAddress(address)
	{
		if (address < 0 || address >= 65535)
			throw new ASAPArgumentException("Invalid music address");
		this.#music = address;
	}

	/**
	 * Returns the address of the player initialization routine.
	 * Returns -1 if no initialization routine.
	 */
	getInitAddress()
	{
		return this.#init;
	}

	/**
	 * Returns the address of the player routine.
	 */
	getPlayerAddress()
	{
		return this.player;
	}

	/**
	 * Returns the address of the COVOX chip.
	 * Returns -1 if no COVOX enabled.
	 */
	getCovoxAddress()
	{
		return this.#covoxAddr;
	}

	/**
	 * Returns the length of the SAP header in bytes.
	 */
	getSapHeaderLength()
	{
		return this.headerLen;
	}

	/**
	 * Returns the offset of instrument names for RMT module.
	 * Returns -1 if not an RMT module or RMT module without instrument names.
	 * @param module Content of the RMT file.
	 * @param moduleLen Length of the RMT file.
	 */
	getInstrumentNamesOffset(module, moduleLen)
	{
		if (this.type != ASAPModuleType.RMT)
			return -1;
		for (let offset = ASAPInfo.getWord(module, 4) - ASAPInfo.getWord(module, 2) + 12; offset < moduleLen; offset++) {
			if (module[offset - 1] == 0)
				return offset;
		}
		return -1;
	}

	/**
	 * Returns human-readable description of the filename extension.
	 * @param ext Filename extension without the leading dot.
	 */
	static getExtDescription(ext)
	{
		switch (ASAPInfo.packExt(ext)) {
		case 7364979:
			return "Slight Atari Player";
		case 6516067:
			return "Chaos Music Composer";
		case 3370339:
			return "CMC \"3/4\"";
		case 7499107:
			return "CMC \"Rzog\"";
		case 7564643:
			return "Stereo Double CMC";
		case 6516068:
			return "CMC DoublePlay";
		case 7629924:
			return "Delta Music Composer";
		case 7630957:
			return "Music ProTracker";
		case 6582381:
			return "MPT DoublePlay";
		case 7630194:
			return "Raster Music Tracker";
		case 6516084:
		case 3698036:
			return "Theta Music Composer 1.x";
		case 3304820:
			return "Theta Music Composer 2.x";
		case 2122598:
			return "Future Composer";
		case 7890296:
			return "Atari 8-bit executable";
		default:
			throw new ASAPFormatException("Unknown extension");
		}
	}

	static RMT_INIT = 3200;

	getRmtSapOffset(module, moduleLen)
	{
		if (this.player != 13315)
			return -1;
		let offset = this.headerLen + ASAPInfo.getWord(module, this.headerLen + 4) - ASAPInfo.getWord(module, this.headerLen + 2) + 7;
		if (offset + 6 >= moduleLen || module[offset + 4] != 82 || module[offset + 5] != 77 || module[offset + 6] != 84)
			return -1;
		return offset;
	}

	getOriginalModuleType(module, moduleLen)
	{
		switch (this.type) {
		case ASAPModuleType.SAP_B:
			if ((this.#init == 1019 || this.#init == 1017) && this.player == 1283)
				return ASAPModuleType.DLT;
			if (((this.#init == 1267 || this.#init == 1263) && this.player == 1283) || (this.#init == 62707 && this.player == 62723))
				return ASAPModuleType.MPT;
			if (this.#init == 3200 || this.getRmtSapOffset(module, moduleLen) > 0)
				return ASAPModuleType.RMT;
			if (this.#init == 1269 || this.#init == 62709 || this.#init == 1266 || ((this.#init == 1255 || this.#init == 62695 || this.#init == 1252) && this.#fastplay == 156) || ((this.#init == 1253 || this.#init == 62693 || this.#init == 1250) && (this.#fastplay == 104 || this.#fastplay == 78)))
				return ASAPModuleType.TMC;
			if ((this.#init == 4224 && this.player == 1283) || (this.#init == 4992 && this.player == 2051))
				return ASAPModuleType.TM2;
			if (this.#init == 1024 && this.player == 1027)
				return ASAPModuleType.FC;
			return this.type;
		case ASAPModuleType.SAP_C:
			if ((this.player == 1280 || this.player == 62720) && moduleLen >= 1024) {
				if (this.#channels > 1)
					return ASAPModuleType.CMS;
				if (module[moduleLen - 170] == 30)
					return ASAPModuleType.CMR;
				if (module[moduleLen - 909] == 48)
					return ASAPModuleType.CM3;
				return ASAPModuleType.CMC;
			}
			return this.type;
		default:
			return this.type;
		}
	}

	/**
	 * Returns the extension of the original module format.
	 * For native modules it simply returns their extension.
	 * For the SAP format it attempts to detect the original module format.
	 * @param module Contents of the file.
	 * @param moduleLen Length of the file.
	 */
	getOriginalModuleExt(module, moduleLen)
	{
		switch (this.getOriginalModuleType(module, moduleLen)) {
		case ASAPModuleType.CMC:
			return this.#fastplay == 156 ? "dmc" : "cmc";
		case ASAPModuleType.CM3:
			return "cm3";
		case ASAPModuleType.CMR:
			return "cmr";
		case ASAPModuleType.CMS:
			return "cms";
		case ASAPModuleType.DLT:
			return "dlt";
		case ASAPModuleType.MPT:
			return this.#fastplay == 156 ? "mpd" : "mpt";
		case ASAPModuleType.RMT:
			return "rmt";
		case ASAPModuleType.TMC:
			return "tmc";
		case ASAPModuleType.TM2:
			return "tm2";
		case ASAPModuleType.FC:
			return "fc";
		default:
			return null;
		}
	}

	static #GET_RMT_INSTRUMENT_FRAMES_RMT_VOLUME_SILENT = new Uint8Array([ 16, 8, 4, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1 ]);
}

class Cpu6502
{
	asap;
	memory = new Uint8Array(65536);
	cycle;
	pc;
	a;
	x;
	y;
	s;
	#nz;
	#c;
	#vdi;

	reset()
	{
		this.cycle = 0;
		this.#nz = 0;
		this.#c = 0;
		this.#vdi = 0;
	}

	#peek(addr)
	{
		if ((addr & 63744) == 53248)
			return this.asap.peekHardware(addr);
		else
			return this.memory[addr];
	}

	#poke(addr, data)
	{
		if ((addr & 63744) == 53248)
			this.asap.pokeHardware(addr, data);
		else
			this.memory[addr] = data;
	}

	#peekReadModifyWrite(addr)
	{
		if (addr >> 8 == 210) {
			this.cycle--;
			let data = this.asap.peekHardware(addr);
			this.asap.pokeHardware(addr, data);
			this.cycle++;
			return data;
		}
		return this.memory[addr];
	}

	#pull()
	{
		let s = (this.s + 1) & 255;
		this.s = s;
		return this.memory[256 + s];
	}

	#pullFlags()
	{
		let data = this.#pull();
		this.#nz = ((data & 128) << 1) + (~data & 2);
		this.#c = data & 1;
		this.#vdi = data & 76;
	}

	#push(data)
	{
		let s = this.s;
		this.memory[256 + s] = data;
		this.s = (s - 1) & 255;
	}

	pushPc()
	{
		this.#push(this.pc >> 8);
		this.#push(this.pc & 255);
	}

	#pushFlags(b)
	{
		let nz = this.#nz;
		b += ((nz | nz >> 1) & 128) + this.#vdi + this.#c;
		if ((nz & 255) == 0)
			b += 2;
		this.#push(b);
	}

	#addWithCarry(data)
	{
		let a = this.a;
		let vdi = this.#vdi;
		let tmp = a + data + this.#c;
		this.#nz = tmp & 255;
		if ((vdi & 8) == 0) {
			this.#vdi = (vdi & 12) + ((~(data ^ a) & (a ^ tmp)) >> 1 & 64);
			this.#c = tmp >> 8;
			this.a = this.#nz;
		}
		else {
			let al = (a & 15) + (data & 15) + this.#c;
			if (al >= 10) {
				tmp += al < 26 ? 6 : -10;
				if (this.#nz != 0)
					this.#nz = (tmp & 128) + 1;
			}
			this.#vdi = (vdi & 12) + ((~(data ^ a) & (a ^ tmp)) >> 1 & 64);
			if (tmp >= 160) {
				this.#c = 1;
				this.a = (tmp - 160) & 255;
			}
			else {
				this.#c = 0;
				this.a = tmp;
			}
		}
	}

	#subtractWithCarry(data)
	{
		let a = this.a;
		let vdi = this.#vdi;
		let borrow = this.#c - 1;
		let tmp = a - data + borrow;
		let al = (a & 15) - (data & 15) + borrow;
		this.#vdi = (vdi & 12) + (((data ^ a) & (a ^ tmp)) >> 1 & 64);
		this.#c = tmp >= 0 ? 1 : 0;
		this.#nz = this.a = tmp & 255;
		if ((vdi & 8) != 0) {
			if (al < 0)
				this.a += al < -10 ? 10 : -6;
			if (this.#c == 0)
				this.a = (this.a - 96) & 255;
		}
	}

	#arithmeticShiftLeft(addr)
	{
		let data = this.#peekReadModifyWrite(addr);
		this.#c = data >> 7;
		data = data << 1 & 255;
		this.#poke(addr, data);
		return data;
	}

	#rotateLeft(addr)
	{
		let data = (this.#peekReadModifyWrite(addr) << 1) + this.#c;
		this.#c = data >> 8;
		data &= 255;
		this.#poke(addr, data);
		return data;
	}

	#logicalShiftRight(addr)
	{
		let data = this.#peekReadModifyWrite(addr);
		this.#c = data & 1;
		data >>= 1;
		this.#poke(addr, data);
		return data;
	}

	#rotateRight(addr)
	{
		let data = (this.#c << 8) + this.#peekReadModifyWrite(addr);
		this.#c = data & 1;
		data >>= 1;
		this.#poke(addr, data);
		return data;
	}

	#decrement(addr)
	{
		let data = (this.#peekReadModifyWrite(addr) - 1) & 255;
		this.#poke(addr, data);
		return data;
	}

	#increment(addr)
	{
		let data = (this.#peekReadModifyWrite(addr) + 1) & 255;
		this.#poke(addr, data);
		return data;
	}

	#executeIrq(b)
	{
		this.pushPc();
		this.#pushFlags(b);
		this.#vdi |= 4;
		this.pc = this.memory[65534] + (this.memory[65535] << 8);
	}

	#checkIrq()
	{
		if ((this.#vdi & 4) == 0 && this.asap.isIrq()) {
			this.cycle += 7;
			this.#executeIrq(32);
		}
	}

	#shx(addr, data)
	{
		addr += this.memory[this.pc++];
		let hi = this.memory[this.pc++];
		data &= hi + 1;
		if (addr >= 256)
			hi = data - 1;
		addr += hi << 8;
		this.#poke(addr, data);
	}

	/**
	 * Runs 6502 emulation for the specified number of Atari scanlines.
	 * Each scanline is 114 cycles of which 9 is taken by ANTIC for memory refresh.
	 */
	doFrame(cycleLimit)
	{
		while (this.cycle < cycleLimit) {
			if (this.cycle >= this.asap.nextEventCycle) {
				this.asap.handleEvent();
				this.#checkIrq();
			}
			let data = this.memory[this.pc++];
			this.cycle += Cpu6502.#DO_FRAME_OPCODE_CYCLES[data];
			let addr = 0;
			switch (data) {
			case 0:
				this.pc++;
				this.#executeIrq(48);
				continue;
			case 1:
			case 3:
			case 33:
			case 35:
			case 65:
			case 67:
			case 97:
			case 99:
			case 129:
			case 131:
			case 161:
			case 163:
			case 193:
			case 195:
			case 225:
			case 227:
				addr = (this.memory[this.pc++] + this.x) & 255;
				addr = this.memory[addr] + (this.memory[(addr + 1) & 255] << 8);
				break;
			case 2:
			case 18:
			case 34:
			case 50:
			case 66:
			case 82:
			case 98:
			case 114:
			case 146:
			case 178:
			case 210:
			case 242:
				this.pc--;
				this.cycle = this.asap.nextEventCycle;
				continue;
			case 4:
			case 68:
			case 100:
			case 20:
			case 52:
			case 84:
			case 116:
			case 212:
			case 244:
			case 128:
			case 130:
			case 137:
			case 194:
			case 226:
				this.pc++;
				continue;
			case 5:
			case 6:
			case 7:
			case 36:
			case 37:
			case 38:
			case 39:
			case 69:
			case 70:
			case 71:
			case 101:
			case 102:
			case 103:
			case 132:
			case 133:
			case 134:
			case 135:
			case 164:
			case 165:
			case 166:
			case 167:
			case 196:
			case 197:
			case 198:
			case 199:
			case 228:
			case 229:
			case 230:
			case 231:
				addr = this.memory[this.pc++];
				break;
			case 8:
				this.#pushFlags(48);
				continue;
			case 9:
			case 41:
			case 73:
			case 105:
			case 160:
			case 162:
			case 169:
			case 192:
			case 201:
			case 224:
			case 233:
			case 235:
				addr = this.pc++;
				break;
			case 10:
				this.#c = this.a >> 7;
				this.#nz = this.a = this.a << 1 & 255;
				continue;
			case 11:
			case 43:
				this.#nz = this.a &= this.memory[this.pc++];
				this.#c = this.#nz >> 7;
				continue;
			case 12:
				this.pc += 2;
				continue;
			case 13:
			case 14:
			case 15:
			case 44:
			case 45:
			case 46:
			case 47:
			case 77:
			case 78:
			case 79:
			case 108:
			case 109:
			case 110:
			case 111:
			case 140:
			case 141:
			case 142:
			case 143:
			case 172:
			case 173:
			case 174:
			case 175:
			case 204:
			case 205:
			case 206:
			case 207:
			case 236:
			case 237:
			case 238:
			case 239:
				addr = this.memory[this.pc++];
				addr += this.memory[this.pc++] << 8;
				break;
			case 16:
				if (this.#nz < 128)
					break;
				this.pc++;
				continue;
			case 17:
			case 49:
			case 81:
			case 113:
			case 177:
			case 179:
			case 209:
			case 241:
				let zp = this.memory[this.pc++];
				addr = this.memory[zp] + this.y;
				if (addr >= 256)
					this.cycle++;
				addr = (addr + (this.memory[(zp + 1) & 255] << 8)) & 65535;
				break;
			case 19:
			case 51:
			case 83:
			case 115:
			case 145:
			case 211:
			case 243:
				addr = this.memory[this.pc++];
				addr = (this.memory[addr] + (this.memory[(addr + 1) & 255] << 8) + this.y) & 65535;
				break;
			case 21:
			case 22:
			case 23:
			case 53:
			case 54:
			case 55:
			case 85:
			case 86:
			case 87:
			case 117:
			case 118:
			case 119:
			case 148:
			case 149:
			case 180:
			case 181:
			case 213:
			case 214:
			case 215:
			case 245:
			case 246:
			case 247:
				addr = (this.memory[this.pc++] + this.x) & 255;
				break;
			case 24:
				this.#c = 0;
				continue;
			case 25:
			case 57:
			case 89:
			case 121:
			case 185:
			case 187:
			case 190:
			case 191:
			case 217:
			case 249:
				addr = this.memory[this.pc++] + this.y;
				if (addr >= 256)
					this.cycle++;
				addr = (addr + (this.memory[this.pc++] << 8)) & 65535;
				break;
			case 27:
			case 59:
			case 91:
			case 123:
			case 153:
			case 219:
			case 251:
				addr = this.memory[this.pc++] + this.y;
				addr = (addr + (this.memory[this.pc++] << 8)) & 65535;
				break;
			case 28:
			case 60:
			case 92:
			case 124:
			case 220:
			case 252:
				if (this.memory[this.pc] + this.x >= 256)
					this.cycle++;
				this.pc += 2;
				continue;
			case 29:
			case 61:
			case 93:
			case 125:
			case 188:
			case 189:
			case 221:
			case 253:
				addr = this.memory[this.pc++] + this.x;
				if (addr >= 256)
					this.cycle++;
				addr = (addr + (this.memory[this.pc++] << 8)) & 65535;
				break;
			case 30:
			case 31:
			case 62:
			case 63:
			case 94:
			case 95:
			case 126:
			case 127:
			case 157:
			case 222:
			case 223:
			case 254:
			case 255:
				addr = this.memory[this.pc++] + this.x;
				addr = (addr + (this.memory[this.pc++] << 8)) & 65535;
				break;
			case 32:
				addr = this.memory[this.pc++];
				this.pushPc();
				this.pc = addr + (this.memory[this.pc] << 8);
				continue;
			case 40:
				this.#pullFlags();
				this.#checkIrq();
				continue;
			case 42:
				this.a = (this.a << 1) + this.#c;
				this.#c = this.a >> 8;
				this.#nz = this.a &= 255;
				continue;
			case 48:
				if (this.#nz >= 128)
					break;
				this.pc++;
				continue;
			case 56:
				this.#c = 1;
				continue;
			case 64:
				this.#pullFlags();
				this.pc = this.#pull();
				this.pc += this.#pull() << 8;
				this.#checkIrq();
				continue;
			case 72:
				this.#push(this.a);
				continue;
			case 74:
				this.#c = this.a & 1;
				this.#nz = this.a >>= 1;
				continue;
			case 75:
				this.a &= this.memory[this.pc++];
				this.#c = this.a & 1;
				this.#nz = this.a >>= 1;
				continue;
			case 76:
				addr = this.memory[this.pc++];
				this.pc = addr + (this.memory[this.pc] << 8);
				continue;
			case 80:
				if ((this.#vdi & 64) == 0)
					break;
				this.pc++;
				continue;
			case 88:
				this.#vdi &= 72;
				this.#checkIrq();
				continue;
			case 96:
				this.pc = this.#pull();
				this.pc += (this.#pull() << 8) + 1;
				continue;
			case 104:
				this.#nz = this.a = this.#pull();
				continue;
			case 106:
				this.#nz = (this.#c << 7) + (this.a >> 1);
				this.#c = this.a & 1;
				this.a = this.#nz;
				continue;
			case 107:
				data = this.a & this.memory[this.pc++];
				this.#nz = this.a = (data >> 1) + (this.#c << 7);
				this.#vdi = (this.#vdi & 12) + ((this.a ^ data) & 64);
				if ((this.#vdi & 8) == 0)
					this.#c = data >> 7;
				else {
					if ((data & 15) >= 5)
						this.a = (this.a & 240) + ((this.a + 6) & 15);
					if (data >= 80) {
						this.a = (this.a + 96) & 255;
						this.#c = 1;
					}
					else
						this.#c = 0;
				}
				continue;
			case 112:
				if ((this.#vdi & 64) != 0)
					break;
				this.pc++;
				continue;
			case 120:
				this.#vdi |= 4;
				continue;
			case 136:
				this.#nz = this.y = (this.y - 1) & 255;
				continue;
			case 138:
				this.#nz = this.a = this.x;
				continue;
			case 139:
				data = this.memory[this.pc++];
				this.a &= (data | 239) & this.x;
				this.#nz = this.a & data;
				continue;
			case 144:
				if (this.#c == 0)
					break;
				this.pc++;
				continue;
			case 147:
				{
					addr = this.memory[this.pc++];
					let hi = this.memory[(addr + 1) & 255];
					addr = this.memory[addr];
					data = (hi + 1) & this.a & this.x;
					addr += this.y;
					if (addr >= 256)
						hi = data - 1;
					addr += hi << 8;
					this.#poke(addr, data);
				}
				continue;
			case 150:
			case 151:
			case 182:
			case 183:
				addr = (this.memory[this.pc++] + this.y) & 255;
				break;
			case 152:
				this.#nz = this.a = this.y;
				continue;
			case 154:
				this.s = this.x;
				continue;
			case 155:
				this.s = this.a & this.x;
				this.#shx(this.y, this.s);
				continue;
			case 156:
				this.#shx(this.x, this.y);
				continue;
			case 158:
				this.#shx(this.y, this.x);
				continue;
			case 159:
				this.#shx(this.y, this.a & this.x);
				continue;
			case 168:
				this.#nz = this.y = this.a;
				continue;
			case 170:
				this.#nz = this.x = this.a;
				continue;
			case 171:
				this.#nz = this.x = this.a &= this.memory[this.pc++];
				continue;
			case 176:
				if (this.#c != 0)
					break;
				this.pc++;
				continue;
			case 184:
				this.#vdi &= 12;
				continue;
			case 186:
				this.#nz = this.x = this.s;
				continue;
			case 200:
				this.#nz = this.y = (this.y + 1) & 255;
				continue;
			case 202:
				this.#nz = this.x = (this.x - 1) & 255;
				continue;
			case 203:
				this.#nz = this.memory[this.pc++];
				this.x &= this.a;
				this.#c = this.x >= this.#nz ? 1 : 0;
				this.#nz = this.x = (this.x - this.#nz) & 255;
				continue;
			case 208:
				if ((this.#nz & 255) != 0)
					break;
				this.pc++;
				continue;
			case 216:
				this.#vdi &= 68;
				continue;
			case 232:
				this.#nz = this.x = (this.x + 1) & 255;
				continue;
			case 234:
			case 26:
			case 58:
			case 90:
			case 122:
			case 218:
			case 250:
				continue;
			case 240:
				if ((this.#nz & 255) == 0)
					break;
				this.pc++;
				continue;
			case 248:
				this.#vdi |= 8;
				continue;
			default:
				throw new Error();
			}
			switch (data) {
			case 1:
			case 5:
			case 9:
			case 13:
			case 17:
			case 21:
			case 25:
			case 29:
				this.#nz = this.a |= this.#peek(addr);
				break;
			case 3:
			case 7:
			case 15:
			case 19:
			case 23:
			case 27:
			case 31:
				this.#nz = this.a |= this.#arithmeticShiftLeft(addr);
				break;
			case 6:
			case 14:
			case 22:
			case 30:
				this.#nz = this.#arithmeticShiftLeft(addr);
				break;
			case 16:
			case 48:
			case 80:
			case 112:
			case 144:
			case 176:
			case 208:
			case 240:
				addr = (this.memory[this.pc] ^ 128) - 128;
				this.pc++;
				addr += this.pc;
				this.cycle += (addr ^ this.pc) >> 8 != 0 ? 2 : 1;
				this.pc = addr;
				break;
			case 33:
			case 37:
			case 41:
			case 45:
			case 49:
			case 53:
			case 57:
			case 61:
				this.#nz = this.a &= this.#peek(addr);
				break;
			case 35:
			case 39:
			case 47:
			case 51:
			case 55:
			case 59:
			case 63:
				this.#nz = this.a &= this.#rotateLeft(addr);
				break;
			case 36:
			case 44:
				this.#nz = this.#peek(addr);
				this.#vdi = (this.#vdi & 12) + (this.#nz & 64);
				this.#nz = ((this.#nz & 128) << 1) + (this.#nz & this.a);
				break;
			case 38:
			case 46:
			case 54:
			case 62:
				this.#nz = this.#rotateLeft(addr);
				break;
			case 65:
			case 69:
			case 73:
			case 77:
			case 81:
			case 85:
			case 89:
			case 93:
				this.#nz = this.a ^= this.#peek(addr);
				break;
			case 67:
			case 71:
			case 79:
			case 83:
			case 87:
			case 91:
			case 95:
				this.#nz = this.a ^= this.#logicalShiftRight(addr);
				break;
			case 70:
			case 78:
			case 86:
			case 94:
				this.#nz = this.#logicalShiftRight(addr);
				break;
			case 97:
			case 101:
			case 105:
			case 109:
			case 113:
			case 117:
			case 121:
			case 125:
				this.#addWithCarry(this.#peek(addr));
				break;
			case 99:
			case 103:
			case 111:
			case 115:
			case 119:
			case 123:
			case 127:
				this.#addWithCarry(this.#rotateRight(addr));
				break;
			case 102:
			case 110:
			case 118:
			case 126:
				this.#nz = this.#rotateRight(addr);
				break;
			case 108:
				this.pc = this.memory[addr];
				if ((++addr & 255) == 0)
					addr -= 255;
				this.pc += this.memory[addr] << 8;
				break;
			case 129:
			case 133:
			case 141:
			case 145:
			case 149:
			case 153:
			case 157:
				this.#poke(addr, this.a);
				break;
			case 131:
			case 135:
			case 143:
			case 151:
				this.#poke(addr, this.a & this.x);
				break;
			case 132:
			case 140:
			case 148:
				this.#poke(addr, this.y);
				break;
			case 134:
			case 142:
			case 150:
				this.#poke(addr, this.x);
				break;
			case 160:
			case 164:
			case 172:
			case 180:
			case 188:
				this.#nz = this.y = this.#peek(addr);
				break;
			case 161:
			case 165:
			case 169:
			case 173:
			case 177:
			case 181:
			case 185:
			case 189:
				this.#nz = this.a = this.#peek(addr);
				break;
			case 162:
			case 166:
			case 174:
			case 182:
			case 190:
				this.#nz = this.x = this.#peek(addr);
				break;
			case 163:
			case 167:
			case 175:
			case 179:
			case 183:
			case 191:
				this.#nz = this.x = this.a = this.#peek(addr);
				break;
			case 187:
				this.#nz = this.x = this.a = this.s &= this.#peek(addr);
				break;
			case 192:
			case 196:
			case 204:
				this.#nz = this.#peek(addr);
				this.#c = this.y >= this.#nz ? 1 : 0;
				this.#nz = (this.y - this.#nz) & 255;
				break;
			case 193:
			case 197:
			case 201:
			case 205:
			case 209:
			case 213:
			case 217:
			case 221:
				this.#nz = this.#peek(addr);
				this.#c = this.a >= this.#nz ? 1 : 0;
				this.#nz = (this.a - this.#nz) & 255;
				break;
			case 195:
			case 199:
			case 207:
			case 211:
			case 215:
			case 219:
			case 223:
				data = this.#decrement(addr);
				this.#c = this.a >= data ? 1 : 0;
				this.#nz = (this.a - data) & 255;
				break;
			case 198:
			case 206:
			case 214:
			case 222:
				this.#nz = this.#decrement(addr);
				break;
			case 224:
			case 228:
			case 236:
				this.#nz = this.#peek(addr);
				this.#c = this.x >= this.#nz ? 1 : 0;
				this.#nz = (this.x - this.#nz) & 255;
				break;
			case 225:
			case 229:
			case 233:
			case 235:
			case 237:
			case 241:
			case 245:
			case 249:
			case 253:
				this.#subtractWithCarry(this.#peek(addr));
				break;
			case 227:
			case 231:
			case 239:
			case 243:
			case 247:
			case 251:
			case 255:
				this.#subtractWithCarry(this.#increment(addr));
				break;
			case 230:
			case 238:
			case 246:
			case 254:
				this.#nz = this.#increment(addr);
				break;
			default:
				throw new Error();
			}
		}
	}

	static #DO_FRAME_OPCODE_CYCLES = new Uint8Array([ 7, 6, 2, 8, 3, 3, 5, 5, 3, 2, 2, 2, 4, 4, 6, 6,
		2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
		6, 6, 2, 8, 3, 3, 5, 5, 4, 2, 2, 2, 4, 4, 6, 6,
		2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
		6, 6, 2, 8, 3, 3, 5, 5, 3, 2, 2, 2, 3, 4, 6, 6,
		2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
		6, 6, 2, 8, 3, 3, 5, 5, 4, 2, 2, 2, 5, 4, 6, 6,
		2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
		2, 6, 2, 6, 3, 3, 3, 3, 2, 2, 2, 2, 4, 4, 4, 4,
		2, 6, 2, 6, 4, 4, 4, 4, 2, 5, 2, 5, 5, 5, 5, 5,
		2, 6, 2, 6, 3, 3, 3, 3, 2, 2, 2, 2, 4, 4, 4, 4,
		2, 5, 2, 5, 4, 4, 4, 4, 2, 4, 2, 4, 4, 4, 4, 4,
		2, 6, 2, 8, 3, 3, 5, 5, 2, 2, 2, 2, 4, 4, 6, 6,
		2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
		2, 6, 2, 8, 3, 3, 5, 5, 2, 2, 2, 2, 4, 4, 6, 6,
		2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7 ]);
}

/**
 * Format of output samples.
 */
export const ASAPSampleFormat = {
	/**
	 * Unsigned 8-bit.
	 */
	U8 : 0,
	/**
	 * Signed 16-bit little-endian.
	 */
	S16_L_E : 1,
	/**
	 * Signed 16-bit big-endian.
	 */
	S16_B_E : 2
}

class PokeyChannel
{
	audf;
	audc;
	periodCycles;
	tickCycle;
	timerCycle;

	static MUTE_INIT = 1;

	static MUTE_USER = 2;

	static MUTE_SERIAL_INPUT = 4;
	mute;
	#out;
	delta;

	initialize()
	{
		this.audf = 0;
		this.audc = 0;
		this.periodCycles = 28;
		this.tickCycle = 8388608;
		this.timerCycle = 8388608;
		this.mute = 0;
		this.#out = 0;
		this.delta = 0;
	}

	slope(pokey, pokeys, cycle)
	{
		this.delta = -this.delta;
		pokey.addDelta(pokeys, cycle, this.delta);
	}

	doTick(pokey, pokeys, cycle, ch)
	{
		this.tickCycle += this.periodCycles;
		let audc = this.audc;
		if ((audc & 176) == 160)
			this.#out ^= 1;
		else if ((audc & 16) != 0 || pokey.init)
			return;
		else {
			let poly = cycle + pokey.polyIndex - ch;
			if (audc < 128 && (1706902752 & 1 << poly % 31) == 0)
				return;
			if ((audc & 32) != 0)
				this.#out ^= 1;
			else {
				let newOut;
				if ((audc & 64) != 0)
					newOut = 21360 >> poly % 15;
				else if (pokey.audctl < 128) {
					poly %= 131071;
					newOut = pokeys.poly17Lookup[poly >> 3] >> (poly & 7);
				}
				else
					newOut = pokeys.poly9Lookup[poly % 511];
				newOut &= 1;
				if (this.#out == newOut)
					return;
				this.#out = newOut;
			}
		}
		this.slope(pokey, pokeys, cycle);
	}

	doStimer(cycle)
	{
		if (this.tickCycle != 8388608)
			this.tickCycle = cycle + this.periodCycles;
	}

	setMute(enable, mask, cycle)
	{
		if (enable) {
			this.mute |= mask;
			this.tickCycle = 8388608;
		}
		else {
			this.mute &= ~mask;
			if (this.mute == 0 && this.tickCycle == 8388608)
				this.tickCycle = cycle;
		}
	}

	setAudc(pokey, pokeys, data, cycle)
	{
		if (this.audc == data)
			return;
		pokey.generateUntilCycle(pokeys, cycle);
		this.audc = data;
		if ((data & 16) != 0) {
			data &= 15;
			if ((this.mute & 2) == 0)
				pokey.addDelta(pokeys, cycle, this.delta > 0 ? data - this.delta : data);
			this.delta = data;
		}
		else {
			data &= 15;
			if (this.delta > 0) {
				if ((this.mute & 2) == 0)
					pokey.addDelta(pokeys, cycle, data - this.delta);
				this.delta = data;
			}
			else
				this.delta = -data;
		}
	}

	endFrame(cycle)
	{
		if (this.timerCycle != 8388608)
			this.timerCycle -= cycle;
	}
}

class Pokey
{
	constructor()
	{
		for (let _i0 = 0; _i0 < 4; _i0++) {
			this.channels[_i0] = new PokeyChannel();
		}
	}
	channels = new Array(4);
	audctl;
	#skctl;
	irqst;
	init;
	#divCycles;
	#reloadCycles1;
	#reloadCycles3;
	polyIndex;

	static NEVER_CYCLE = 8388608;
	#deltaBufferLength;
	#deltaBuffer;
	#sumDACInputs;
	#sumDACOutputs;

	static #COMPRESSED_SUMS = new Int16Array([ 0, 35, 73, 111, 149, 189, 228, 266, 304, 342, 379, 415, 450, 484, 516, 546,
		575, 602, 628, 652, 674, 695, 715, 733, 750, 766, 782, 796, 809, 822, 834, 846,
		856, 867, 876, 886, 894, 903, 911, 918, 926, 933, 939, 946, 952, 958, 963, 969,
		974, 979, 984, 988, 993, 997, 1001, 1005, 1009, 1013, 1016, 1019, 1023 ]);

	static INTERPOLATION_SHIFT = 10;

	static UNIT_DELTA_LENGTH = 32;

	static DELTA_RESOLUTION = 14;
	#iirRate;
	#iirAcc;
	#trailing;

	startFrame()
	{
		this.#deltaBuffer.set(this.#deltaBuffer.subarray(this.#trailing, this.#trailing + this.#deltaBufferLength - this.#trailing));
		this.#deltaBuffer.fill(0, this.#deltaBufferLength - this.#trailing, this.#deltaBufferLength - this.#trailing + this.#trailing);
	}

	initialize(sampleRate = 44100)
	{
		let sr = BigInt(sampleRate);
		this.#deltaBufferLength = Number(sr * 312n * 114n / 1773447n + 32n + 2n);
		this.#deltaBuffer = new Int32Array(this.#deltaBufferLength);
		this.#trailing = this.#deltaBufferLength;
		for (const c of this.channels)
			c.initialize();
		this.audctl = 0;
		this.#skctl = 3;
		this.irqst = 255;
		this.init = false;
		this.#divCycles = 28;
		this.#reloadCycles1 = 28;
		this.#reloadCycles3 = 28;
		this.polyIndex = 60948015;
		this.#iirAcc = 0;
		this.#iirRate = 264600 / sampleRate | 0;
		this.#sumDACInputs = 0;
		this.#sumDACOutputs = 0;
		this.startFrame();
	}

	addDelta(pokeys, cycle, delta)
	{
		this.#sumDACInputs += delta;
		let newOutput = Pokey.#COMPRESSED_SUMS[this.#sumDACInputs] << 16;
		this.addExternalDelta(pokeys, cycle, newOutput - this.#sumDACOutputs);
		this.#sumDACOutputs = newOutput;
	}

	addExternalDelta(pokeys, cycle, delta)
	{
		if (delta == 0)
			return;
		let i = cycle * pokeys.sampleFactor + pokeys.sampleOffset;
		let fraction = i >> 8 & 1023;
		i >>= 18;
		delta >>= 14;
		for (let j = 0; j < 32; j++)
			this.#deltaBuffer[i + j] += delta * pokeys.sincLookup[fraction][j];
	}

	/**
	 * Fills <code>DeltaBuffer</code> up to <code>cycleLimit</code> basing on current Audf/Audc/Audctl values.
	 */
	generateUntilCycle(pokeys, cycleLimit)
	{
		for (;;) {
			let cycle = cycleLimit;
			for (const c of this.channels) {
				let tickCycle = c.tickCycle;
				if (cycle > tickCycle)
					cycle = tickCycle;
			}
			if (cycle == cycleLimit)
				break;
			if (cycle == this.channels[2].tickCycle) {
				if ((this.audctl & 4) != 0 && this.channels[0].delta > 0 && this.channels[0].mute == 0)
					this.channels[0].slope(this, pokeys, cycle);
				this.channels[2].doTick(this, pokeys, cycle, 2);
			}
			if (cycle == this.channels[3].tickCycle) {
				if ((this.audctl & 8) != 0)
					this.channels[2].tickCycle = cycle + this.#reloadCycles3;
				if ((this.audctl & 2) != 0 && this.channels[1].delta > 0 && this.channels[1].mute == 0)
					this.channels[1].slope(this, pokeys, cycle);
				this.channels[3].doTick(this, pokeys, cycle, 3);
			}
			if (cycle == this.channels[0].tickCycle) {
				if ((this.#skctl & 136) == 8)
					this.channels[1].tickCycle = cycle + this.channels[1].periodCycles;
				this.channels[0].doTick(this, pokeys, cycle, 0);
			}
			if (cycle == this.channels[1].tickCycle) {
				if ((this.audctl & 16) != 0)
					this.channels[0].tickCycle = cycle + this.#reloadCycles1;
				else if ((this.#skctl & 8) != 0)
					this.channels[0].tickCycle = cycle + this.channels[0].periodCycles;
				this.channels[1].doTick(this, pokeys, cycle, 1);
			}
		}
	}

	endFrame(pokeys, cycle)
	{
		this.generateUntilCycle(pokeys, cycle);
		this.polyIndex += cycle;
		let m = (this.audctl & 128) != 0 ? 237615 : 60948015;
		if (this.polyIndex >= 2 * m)
			this.polyIndex -= m;
		for (const c of this.channels) {
			let tickCycle = c.tickCycle;
			if (tickCycle != 8388608)
				c.tickCycle = tickCycle - cycle;
		}
	}

	isSilent()
	{
		for (const c of this.channels)
			if ((c.audc & 15) != 0)
				return false;
		return true;
	}

	mute(mask)
	{
		for (let i = 0; i < 4; i++)
			this.channels[i].setMute((mask & 1 << i) != 0, 2, 0);
	}

	#initMute(cycle)
	{
		let init = this.init;
		let audctl = this.audctl;
		this.channels[0].setMute(init && (audctl & 64) == 0, 1, cycle);
		this.channels[1].setMute(init && (audctl & 80) != 80, 1, cycle);
		this.channels[2].setMute(init && (audctl & 32) == 0, 1, cycle);
		this.channels[3].setMute(init && (audctl & 40) != 40, 1, cycle);
	}

	poke(pokeys, addr, data, cycle)
	{
		let nextEventCycle = 8388608;
		switch (addr & 15) {
		case 0:
			if (data == this.channels[0].audf)
				break;
			this.generateUntilCycle(pokeys, cycle);
			this.channels[0].audf = data;
			switch (this.audctl & 80) {
			case 0:
				this.channels[0].periodCycles = this.#divCycles * (data + 1);
				break;
			case 16:
				this.channels[1].periodCycles = this.#divCycles * (data + (this.channels[1].audf << 8) + 1);
				this.#reloadCycles1 = this.#divCycles * (data + 1);
				break;
			case 64:
				this.channels[0].periodCycles = data + 4;
				break;
			case 80:
				this.channels[1].periodCycles = data + (this.channels[1].audf << 8) + 7;
				this.#reloadCycles1 = data + 4;
				break;
			default:
				throw new Error();
			}
			break;
		case 1:
			this.channels[0].setAudc(this, pokeys, data, cycle);
			break;
		case 2:
			if (data == this.channels[1].audf)
				break;
			this.generateUntilCycle(pokeys, cycle);
			this.channels[1].audf = data;
			switch (this.audctl & 80) {
			case 0:
			case 64:
				this.channels[1].periodCycles = this.#divCycles * (data + 1);
				break;
			case 16:
				this.channels[1].periodCycles = this.#divCycles * (this.channels[0].audf + (data << 8) + 1);
				break;
			case 80:
				this.channels[1].periodCycles = this.channels[0].audf + (data << 8) + 7;
				break;
			default:
				throw new Error();
			}
			break;
		case 3:
			this.channels[1].setAudc(this, pokeys, data, cycle);
			break;
		case 4:
			if (data == this.channels[2].audf)
				break;
			this.generateUntilCycle(pokeys, cycle);
			this.channels[2].audf = data;
			switch (this.audctl & 40) {
			case 0:
				this.channels[2].periodCycles = this.#divCycles * (data + 1);
				break;
			case 8:
				this.channels[3].periodCycles = this.#divCycles * (data + (this.channels[3].audf << 8) + 1);
				this.#reloadCycles3 = this.#divCycles * (data + 1);
				break;
			case 32:
				this.channels[2].periodCycles = data + 4;
				break;
			case 40:
				this.channels[3].periodCycles = data + (this.channels[3].audf << 8) + 7;
				this.#reloadCycles3 = data + 4;
				break;
			default:
				throw new Error();
			}
			break;
		case 5:
			this.channels[2].setAudc(this, pokeys, data, cycle);
			break;
		case 6:
			if (data == this.channels[3].audf)
				break;
			this.generateUntilCycle(pokeys, cycle);
			this.channels[3].audf = data;
			switch (this.audctl & 40) {
			case 0:
			case 32:
				this.channels[3].periodCycles = this.#divCycles * (data + 1);
				break;
			case 8:
				this.channels[3].periodCycles = this.#divCycles * (this.channels[2].audf + (data << 8) + 1);
				break;
			case 40:
				this.channels[3].periodCycles = this.channels[2].audf + (data << 8) + 7;
				break;
			default:
				throw new Error();
			}
			break;
		case 7:
			this.channels[3].setAudc(this, pokeys, data, cycle);
			break;
		case 8:
			if (data == this.audctl)
				break;
			this.generateUntilCycle(pokeys, cycle);
			this.audctl = data;
			this.#divCycles = (data & 1) != 0 ? 114 : 28;
			switch (data & 80) {
			case 0:
				this.channels[0].periodCycles = this.#divCycles * (this.channels[0].audf + 1);
				this.channels[1].periodCycles = this.#divCycles * (this.channels[1].audf + 1);
				break;
			case 16:
				this.channels[0].periodCycles = this.#divCycles << 8;
				this.channels[1].periodCycles = this.#divCycles * (this.channels[0].audf + (this.channels[1].audf << 8) + 1);
				this.#reloadCycles1 = this.#divCycles * (this.channels[0].audf + 1);
				break;
			case 64:
				this.channels[0].periodCycles = this.channels[0].audf + 4;
				this.channels[1].periodCycles = this.#divCycles * (this.channels[1].audf + 1);
				break;
			case 80:
				this.channels[0].periodCycles = 256;
				this.channels[1].periodCycles = this.channels[0].audf + (this.channels[1].audf << 8) + 7;
				this.#reloadCycles1 = this.channels[0].audf + 4;
				break;
			default:
				throw new Error();
			}
			switch (data & 40) {
			case 0:
				this.channels[2].periodCycles = this.#divCycles * (this.channels[2].audf + 1);
				this.channels[3].periodCycles = this.#divCycles * (this.channels[3].audf + 1);
				break;
			case 8:
				this.channels[2].periodCycles = this.#divCycles << 8;
				this.channels[3].periodCycles = this.#divCycles * (this.channels[2].audf + (this.channels[3].audf << 8) + 1);
				this.#reloadCycles3 = this.#divCycles * (this.channels[2].audf + 1);
				break;
			case 32:
				this.channels[2].periodCycles = this.channels[2].audf + 4;
				this.channels[3].periodCycles = this.#divCycles * (this.channels[3].audf + 1);
				break;
			case 40:
				this.channels[2].periodCycles = 256;
				this.channels[3].periodCycles = this.channels[2].audf + (this.channels[3].audf << 8) + 7;
				this.#reloadCycles3 = this.channels[2].audf + 4;
				break;
			default:
				throw new Error();
			}
			this.#initMute(cycle);
			break;
		case 9:
			for (const c of this.channels)
				c.doStimer(cycle);
			break;
		case 14:
			this.irqst |= data ^ 255;
			for (let i = 3;; i >>= 1) {
				if ((data & this.irqst & (i + 1)) != 0) {
					if (this.channels[i].timerCycle == 8388608) {
						let t = this.channels[i].tickCycle;
						while (t < cycle)
							t += this.channels[i].periodCycles;
						this.channels[i].timerCycle = t;
						if (nextEventCycle > t)
							nextEventCycle = t;
					}
				}
				else
					this.channels[i].timerCycle = 8388608;
				if (i == 0)
					break;
			}
			break;
		case 15:
			if (data == this.#skctl)
				break;
			this.generateUntilCycle(pokeys, cycle);
			this.#skctl = data;
			let init = (data & 3) == 0;
			if (this.init && !init)
				this.polyIndex = ((this.audctl & 128) != 0 ? 237614 : 60948014) - cycle;
			this.init = init;
			this.#initMute(cycle);
			this.channels[2].setMute((data & 16) != 0, 4, cycle);
			this.channels[3].setMute((data & 16) != 0, 4, cycle);
			break;
		default:
			break;
		}
		return nextEventCycle;
	}

	checkIrq(cycle, nextEventCycle)
	{
		for (let i = 3;; i >>= 1) {
			let timerCycle = this.channels[i].timerCycle;
			if (cycle >= timerCycle) {
				this.irqst &= ~(i + 1);
				this.channels[i].timerCycle = 8388608;
			}
			else if (nextEventCycle > timerCycle)
				nextEventCycle = timerCycle;
			if (i == 0)
				break;
		}
		return nextEventCycle;
	}

	storeSample(buffer, bufferOffset, i, format)
	{
		this.#iirAcc += this.#deltaBuffer[i] - (this.#iirRate * this.#iirAcc >> 11);
		let sample = this.#iirAcc >> 11;
		if (sample < -32767)
			sample = -32767;
		else if (sample > 32767)
			sample = 32767;
		switch (format) {
		case ASAPSampleFormat.U8:
			buffer[bufferOffset++] = (sample >> 8) + 128;
			break;
		case ASAPSampleFormat.S16_L_E:
			buffer[bufferOffset++] = sample & 255;
			buffer[bufferOffset++] = sample >> 8 & 255;
			break;
		case ASAPSampleFormat.S16_B_E:
			buffer[bufferOffset++] = sample >> 8 & 255;
			buffer[bufferOffset++] = sample & 255;
			break;
		}
		return bufferOffset;
	}

	accumulateTrailing(i)
	{
		this.#trailing = i;
	}
}

class PokeyPair
{
	constructor()
	{
		for (let _i0 = 0; _i0 < 1024; _i0++) {
			this.sincLookup[_i0] = new Int16Array(32);
		}
		let reg = 511;
		for (let i = 0; i < 511; i++) {
			reg = (((reg >> 5 ^ reg) & 1) << 8) + (reg >> 1);
			this.poly9Lookup[i] = reg & 255;
		}
		reg = 131071;
		for (let i = 0; i < 16385; i++) {
			reg = (((reg >> 5 ^ reg) & 255) << 9) + (reg >> 8);
			this.poly17Lookup[i] = reg >> 1 & 255;
		}
		for (let i = 0; i < 1024; i++) {
			let sincSum = 0;
			let leftSum = 0;
			let norm = 0;
			const sinc = new Float64Array(31);
			for (let j = -32; j < 32; j++) {
				if (j == -16)
					leftSum = sincSum;
				else if (j == 15)
					norm = sincSum;
				let x = 3.141592653589793 / 1024 * ((j << 10) - i);
				let s = x == 0 ? 1 : Math.sin(x) / x;
				if (j >= -16 && j < 15)
					sinc[16 + j] = s;
				sincSum += s;
			}
			norm = 16384 / (norm + (1 - sincSum) * 0.5);
			this.sincLookup[i][0] = Math.round((leftSum + (1 - sincSum) * 0.5) * norm);
			for (let j = 1; j < 32; j++)
				this.sincLookup[i][j] = Math.round(sinc[j - 1] * norm);
		}
	}
	poly9Lookup = new Uint8Array(511);
	poly17Lookup = new Uint8Array(16385);
	#extraPokeyMask;
	basePokey = new Pokey();
	extraPokey = new Pokey();
	sampleRate;
	sincLookup = new Array(1024);

	static SAMPLE_FACTOR_SHIFT = 18;
	sampleFactor;
	sampleOffset;
	readySamplesStart;
	readySamplesEnd;

	#getSampleFactor(clock)
	{
		return ((this.sampleRate << 13) + (clock >> 6)) / (clock >> 5) | 0;
	}

	initialize(ntsc, stereo, sampleRate = 44100)
	{
		this.#extraPokeyMask = stereo ? 16 : 0;
		this.sampleRate = sampleRate;
		this.basePokey.initialize(sampleRate);
		this.extraPokey.initialize(sampleRate);
		this.sampleFactor = ntsc ? this.#getSampleFactor(1789772) : this.#getSampleFactor(1773447);
		this.sampleOffset = 0;
		this.readySamplesStart = 0;
		this.readySamplesEnd = 0;
	}

	poke(addr, data, cycle)
	{
		let pokey = (addr & this.#extraPokeyMask) != 0 ? this.extraPokey : this.basePokey;
		return pokey.poke(this, addr, data, cycle);
	}

	peek(addr, cycle)
	{
		let pokey = (addr & this.#extraPokeyMask) != 0 ? this.extraPokey : this.basePokey;
		switch (addr & 15) {
		case 10:
			if (pokey.init)
				return 255;
			let i = cycle + pokey.polyIndex;
			if ((pokey.audctl & 128) != 0)
				return this.poly9Lookup[i % 511];
			i %= 131071;
			let j = i >> 3;
			i &= 7;
			return ((this.poly17Lookup[j] >> i) + (this.poly17Lookup[j + 1] << (8 - i))) & 255;
		case 14:
			return pokey.irqst;
		default:
			return 255;
		}
	}

	startFrame()
	{
		this.basePokey.startFrame();
		if (this.#extraPokeyMask != 0)
			this.extraPokey.startFrame();
	}

	endFrame(cycle)
	{
		this.basePokey.endFrame(this, cycle);
		if (this.#extraPokeyMask != 0)
			this.extraPokey.endFrame(this, cycle);
		this.sampleOffset += cycle * this.sampleFactor;
		this.readySamplesStart = 0;
		this.readySamplesEnd = this.sampleOffset >> 18;
		this.sampleOffset &= 262143;
		return this.readySamplesEnd;
	}

	/**
	 * Fills buffer with samples from <code>DeltaBuffer</code>.
	 */
	generate(buffer, bufferOffset, blocks, format)
	{
		let i = this.readySamplesStart;
		let samplesEnd = this.readySamplesEnd;
		if (blocks < samplesEnd - i)
			samplesEnd = i + blocks;
		else
			blocks = samplesEnd - i;
		if (blocks > 0) {
			for (; i < samplesEnd; i++) {
				bufferOffset = this.basePokey.storeSample(buffer, bufferOffset, i, format);
				if (this.#extraPokeyMask != 0)
					bufferOffset = this.extraPokey.storeSample(buffer, bufferOffset, i, format);
			}
			if (i == this.readySamplesEnd) {
				this.basePokey.accumulateTrailing(i);
				this.extraPokey.accumulateTrailing(i);
			}
			this.readySamplesStart = i;
		}
		return blocks;
	}

	isSilent()
	{
		return this.basePokey.isSilent() && this.extraPokey.isSilent();
	}
}

class Fu
{
	static cm3_obx = new Uint8Array([
		255, 255, 0, 5, 223, 12, 76, 18, 11, 76, 120, 5, 76, 203, 7, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 160, 227, 237, 227, 160, 240, 236, 225,
		249, 229, 242, 160, 246, 160, 178, 174, 177, 160, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255,
		255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 128, 128, 128, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 141, 110,
		5, 142, 111, 5, 140, 112, 5, 41, 112, 74, 74, 74, 170, 189, 148, 11,
		141, 169, 5, 189, 149, 11, 141, 170, 5, 169, 3, 141, 15, 210, 216, 165,
		254, 72, 165, 255, 72, 172, 112, 5, 174, 111, 5, 173, 110, 5, 32, 178,
		5, 104, 133, 255, 104, 133, 254, 96, 173, 118, 5, 133, 254, 173, 119, 5,
		133, 255, 160, 0, 138, 240, 28, 177, 254, 201, 143, 240, 4, 201, 239, 208,
		12, 202, 208, 9, 200, 192, 84, 176, 9, 152, 170, 16, 6, 200, 192, 84,
		144, 229, 96, 142, 104, 5, 32, 123, 6, 169, 0, 162, 9, 157, 69, 5,
		202, 16, 250, 141, 103, 5, 169, 1, 141, 113, 5, 169, 255, 141, 106, 5,
		173, 114, 5, 133, 254, 173, 115, 5, 133, 255, 160, 19, 177, 254, 170, 173,
		118, 5, 133, 254, 173, 119, 5, 133, 255, 172, 104, 5, 177, 254, 201, 207,
		208, 13, 152, 24, 105, 85, 168, 177, 254, 48, 15, 170, 76, 52, 6, 201,
		143, 240, 7, 201, 239, 240, 3, 136, 16, 226, 142, 108, 5, 142, 109, 5,
		96, 41, 15, 240, 245, 142, 221, 10, 142, 243, 10, 142, 2, 11, 140, 222,
		10, 140, 244, 10, 140, 3, 11, 96, 142, 114, 5, 134, 254, 140, 115, 5,
		132, 255, 24, 138, 105, 20, 141, 116, 5, 152, 105, 0, 141, 117, 5, 142,
		118, 5, 200, 200, 140, 119, 5, 160, 19, 177, 254, 141, 108, 5, 141, 109,
		5, 162, 8, 169, 0, 141, 113, 5, 157, 0, 210, 224, 3, 176, 8, 157,
		9, 5, 169, 255, 157, 57, 5, 202, 16, 233, 169, 128, 162, 3, 157, 75,
		5, 202, 16, 250, 96, 169, 1, 141, 113, 5, 169, 0, 240, 238, 41, 3,
		201, 3, 240, 240, 224, 64, 176, 236, 192, 26, 176, 232, 170, 169, 128, 157,
		75, 5, 169, 0, 157, 57, 5, 157, 60, 5, 157, 63, 5, 173, 111, 5,
		157, 12, 5, 173, 112, 5, 10, 10, 10, 133, 254, 24, 173, 114, 5, 105,
		48, 72, 173, 115, 5, 105, 1, 168, 104, 24, 101, 254, 157, 97, 5, 152,
		105, 0, 157, 100, 5, 24, 173, 114, 5, 105, 148, 133, 254, 173, 115, 5,
		105, 0, 133, 255, 173, 112, 5, 10, 109, 112, 5, 10, 168, 177, 254, 157,
		79, 5, 200, 177, 254, 157, 82, 5, 41, 7, 141, 110, 5, 200, 177, 254,
		157, 85, 5, 200, 177, 254, 157, 88, 5, 200, 177, 254, 157, 91, 5, 200,
		177, 254, 157, 94, 5, 160, 0, 173, 110, 5, 201, 3, 208, 2, 160, 2,
		201, 7, 208, 2, 160, 4, 185, 178, 11, 133, 254, 185, 179, 11, 133, 255,
		189, 85, 5, 74, 74, 74, 74, 24, 109, 111, 5, 141, 111, 5, 141, 194,
		7, 168, 173, 110, 5, 201, 7, 208, 15, 152, 10, 168, 177, 254, 157, 45,
		5, 200, 140, 111, 5, 76, 131, 7, 177, 254, 157, 45, 5, 189, 85, 5,
		41, 15, 24, 109, 111, 5, 141, 111, 5, 172, 111, 5, 173, 110, 5, 201,
		5, 8, 177, 254, 40, 240, 8, 221, 45, 5, 208, 3, 56, 233, 1, 157,
		48, 5, 189, 79, 5, 72, 41, 3, 168, 185, 184, 11, 157, 54, 5, 104,
		74, 74, 74, 74, 160, 62, 201, 15, 240, 16, 160, 55, 201, 14, 240, 10,
		160, 48, 201, 13, 240, 4, 24, 105, 0, 168, 185, 188, 11, 157, 51, 5,
		96, 216, 165, 252, 72, 165, 253, 72, 165, 254, 72, 165, 255, 72, 173, 113,
		5, 208, 3, 76, 5, 11, 173, 78, 5, 240, 3, 76, 110, 9, 173, 108,
		5, 205, 109, 5, 240, 3, 76, 91, 9, 173, 103, 5, 240, 3, 76, 220,
		8, 162, 2, 188, 75, 5, 48, 3, 157, 75, 5, 157, 69, 5, 202, 16,
		242, 173, 118, 5, 133, 252, 173, 119, 5, 133, 253, 172, 104, 5, 132, 254,
		204, 106, 5, 208, 25, 173, 107, 5, 240, 20, 173, 104, 5, 172, 105, 5,
		140, 104, 5, 206, 107, 5, 208, 232, 141, 104, 5, 168, 16, 226, 162, 0,
		177, 252, 201, 254, 208, 14, 172, 104, 5, 200, 196, 254, 240, 67, 140, 104,
		5, 76, 26, 8, 157, 66, 5, 24, 152, 105, 85, 168, 232, 224, 3, 144,
		223, 172, 104, 5, 177, 252, 16, 122, 201, 255, 240, 118, 74, 74, 74, 41,
		14, 170, 189, 164, 11, 141, 126, 8, 189, 165, 11, 141, 127, 8, 173, 67,
		5, 133, 255, 32, 147, 8, 140, 104, 5, 192, 85, 176, 4, 196, 254, 208,
		143, 164, 254, 140, 104, 5, 76, 5, 11, 32, 148, 6, 160, 255, 96, 48,
		251, 168, 96, 48, 247, 56, 152, 229, 255, 168, 96, 48, 239, 24, 152, 101,
		255, 168, 96, 48, 231, 141, 108, 5, 141, 109, 5, 200, 96, 48, 221, 173,
		68, 5, 48, 216, 141, 107, 5, 200, 140, 105, 5, 24, 152, 101, 255, 141,
		106, 5, 96, 136, 48, 10, 177, 252, 201, 143, 240, 4, 201, 239, 208, 243,
		200, 96, 162, 2, 189, 72, 5, 240, 5, 222, 72, 5, 16, 99, 189, 75,
		5, 208, 94, 188, 66, 5, 192, 64, 176, 87, 173, 116, 5, 133, 252, 173,
		117, 5, 133, 253, 177, 252, 133, 254, 24, 152, 105, 64, 168, 177, 252, 133,
		255, 37, 254, 201, 255, 240, 58, 188, 69, 5, 177, 254, 41, 192, 208, 12,
		177, 254, 41, 63, 157, 15, 5, 254, 69, 5, 16, 235, 201, 64, 208, 19,
		177, 254, 41, 63, 141, 111, 5, 189, 15, 5, 141, 112, 5, 32, 188, 6,
		76, 72, 9, 201, 128, 208, 10, 177, 254, 41, 63, 157, 72, 5, 254, 69,
		5, 202, 16, 144, 174, 103, 5, 232, 224, 48, 144, 2, 162, 0, 142, 103,
		5, 206, 109, 5, 208, 14, 173, 108, 5, 141, 109, 5, 173, 103, 5, 208,
		3, 238, 104, 5, 172, 48, 5, 173, 82, 5, 41, 7, 201, 5, 240, 4,
		201, 6, 208, 1, 136, 140, 39, 5, 160, 0, 201, 5, 240, 4, 201, 6,
		208, 2, 160, 2, 201, 7, 208, 2, 160, 40, 140, 44, 5, 162, 2, 189,
		82, 5, 41, 224, 157, 40, 5, 189, 97, 5, 133, 252, 189, 100, 5, 133,
		253, 189, 57, 5, 201, 255, 240, 54, 201, 15, 208, 32, 189, 63, 5, 240,
		45, 222, 63, 5, 189, 63, 5, 208, 37, 188, 9, 5, 240, 1, 136, 152,
		157, 9, 5, 189, 88, 5, 157, 63, 5, 76, 232, 9, 189, 57, 5, 74,
		168, 177, 252, 144, 4, 74, 74, 74, 74, 41, 15, 157, 9, 5, 188, 45,
		5, 189, 82, 5, 41, 7, 201, 1, 208, 31, 136, 152, 200, 221, 48, 5,
		8, 169, 1, 40, 208, 2, 10, 10, 61, 60, 5, 240, 12, 188, 48, 5,
		192, 255, 208, 5, 169, 0, 157, 9, 5, 152, 157, 36, 5, 169, 1, 141,
		110, 5, 189, 57, 5, 201, 15, 240, 56, 41, 7, 168, 185, 208, 12, 133,
		254, 189, 57, 5, 41, 8, 8, 138, 40, 24, 240, 2, 105, 3, 168, 185,
		91, 5, 37, 254, 240, 27, 189, 51, 5, 157, 36, 5, 142, 110, 5, 202,
		16, 8, 141, 39, 5, 169, 0, 141, 44, 5, 232, 189, 54, 5, 157, 40,
		5, 189, 57, 5, 41, 15, 201, 15, 240, 16, 254, 57, 5, 189, 57, 5,
		201, 15, 208, 6, 189, 88, 5, 157, 63, 5, 189, 75, 5, 16, 10, 189,
		9, 5, 208, 5, 169, 64, 157, 75, 5, 254, 60, 5, 160, 0, 189, 82,
		5, 74, 74, 74, 74, 144, 1, 136, 74, 144, 1, 200, 24, 152, 125, 45,
		5, 157, 45, 5, 189, 48, 5, 201, 255, 208, 2, 160, 0, 24, 152, 125,
		48, 5, 157, 48, 5, 202, 48, 3, 76, 153, 9, 173, 40, 5, 141, 43,
		5, 173, 82, 5, 41, 7, 170, 160, 3, 173, 110, 5, 240, 3, 188, 216,
		12, 152, 72, 185, 188, 12, 8, 41, 127, 170, 152, 41, 3, 10, 168, 189,
		36, 5, 153, 0, 210, 200, 189, 9, 5, 224, 3, 208, 3, 173, 9, 5,
		29, 40, 5, 40, 16, 2, 169, 0, 153, 0, 210, 104, 168, 136, 41, 3,
		208, 207, 160, 8, 173, 44, 5, 153, 0, 210, 24, 104, 133, 255, 104, 133,
		254, 104, 133, 253, 104, 133, 252, 96, 104, 170, 240, 78, 201, 2, 240, 6,
		104, 104, 202, 208, 251, 96, 165, 20, 197, 20, 240, 252, 173, 36, 2, 201,
		137, 208, 7, 173, 37, 2, 201, 11, 240, 230, 173, 36, 2, 141, 146, 11,
		173, 37, 2, 141, 147, 11, 169, 137, 141, 36, 2, 169, 11, 141, 37, 2,
		104, 104, 240, 3, 56, 233, 1, 141, 96, 11, 104, 168, 104, 170, 169, 112,
		32, 120, 5, 169, 0, 162, 0, 76, 120, 5, 165, 20, 197, 20, 240, 252,
		173, 36, 2, 201, 137, 208, 174, 173, 37, 2, 201, 11, 208, 167, 173, 146,
		11, 141, 36, 2, 173, 147, 11, 141, 37, 2, 169, 64, 76, 120, 5, 32,
		203, 7, 144, 3, 32, 120, 11, 76, 255, 255, 178, 5, 221, 5, 168, 6,
		59, 6, 123, 6, 148, 6, 159, 6, 82, 6, 147, 8, 153, 8, 157, 8,
		165, 8, 173, 8, 183, 8, 205, 8, 188, 11, 253, 11, 62, 12, 128, 160,
		32, 64, 255, 241, 228, 215, 203, 192, 181, 170, 161, 152, 143, 135, 127, 120,
		114, 107, 101, 95, 90, 85, 80, 75, 71, 67, 63, 60, 56, 53, 50, 47,
		44, 42, 39, 37, 35, 33, 31, 29, 28, 26, 24, 23, 22, 20, 19, 18,
		17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
		1, 0, 0, 0, 0, 0, 0, 242, 233, 218, 206, 191, 182, 170, 161, 152,
		143, 137, 128, 122, 113, 107, 101, 95, 0, 86, 80, 103, 96, 90, 85, 81,
		76, 72, 67, 63, 61, 57, 52, 51, 57, 45, 42, 40, 37, 36, 33, 31,
		30, 0, 0, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
		2, 1, 0, 0, 56, 11, 140, 10, 0, 10, 106, 9, 232, 8, 106, 8,
		239, 7, 128, 7, 8, 7, 174, 6, 70, 6, 230, 5, 149, 5, 65, 5,
		246, 4, 176, 4, 110, 4, 48, 4, 246, 3, 187, 3, 132, 3, 82, 3,
		34, 3, 244, 2, 200, 2, 160, 2, 122, 2, 85, 2, 52, 2, 20, 2,
		245, 1, 216, 1, 189, 1, 164, 1, 141, 1, 119, 1, 96, 1, 78, 1,
		56, 1, 39, 1, 21, 1, 6, 1, 247, 0, 232, 0, 219, 0, 207, 0,
		195, 0, 184, 0, 172, 0, 162, 0, 154, 0, 144, 0, 136, 0, 127, 0,
		120, 0, 112, 0, 106, 0, 100, 0, 94, 0, 87, 0, 82, 0, 50, 0,
		10, 0, 0, 1, 2, 131, 0, 1, 2, 3, 1, 0, 2, 131, 1, 0,
		2, 3, 1, 2, 128, 3, 128, 64, 32, 16, 8, 4, 2, 1, 3, 3,
		3, 3, 7, 11, 15, 19 ]);
	static cmc_obx = new Uint8Array([
		255, 255, 0, 5, 220, 12, 76, 15, 11, 76, 120, 5, 76, 203, 7, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 160, 227, 237, 227, 160, 240, 236, 225,
		249, 229, 242, 160, 246, 160, 178, 174, 177, 160, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255,
		255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 128, 128, 128, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 141, 110,
		5, 142, 111, 5, 140, 112, 5, 41, 112, 74, 74, 74, 170, 189, 145, 11,
		141, 169, 5, 189, 146, 11, 141, 170, 5, 169, 3, 141, 15, 210, 216, 165,
		254, 72, 165, 255, 72, 172, 112, 5, 174, 111, 5, 173, 110, 5, 32, 178,
		5, 104, 133, 255, 104, 133, 254, 96, 173, 118, 5, 133, 254, 173, 119, 5,
		133, 255, 160, 0, 138, 240, 28, 177, 254, 201, 143, 240, 4, 201, 239, 208,
		12, 202, 208, 9, 200, 192, 84, 176, 9, 152, 170, 16, 6, 200, 192, 84,
		144, 229, 96, 142, 104, 5, 32, 123, 6, 169, 0, 162, 9, 157, 69, 5,
		202, 16, 250, 141, 103, 5, 169, 1, 141, 113, 5, 169, 255, 141, 106, 5,
		173, 114, 5, 133, 254, 173, 115, 5, 133, 255, 160, 19, 177, 254, 170, 173,
		118, 5, 133, 254, 173, 119, 5, 133, 255, 172, 104, 5, 177, 254, 201, 207,
		208, 13, 152, 24, 105, 85, 168, 177, 254, 48, 15, 170, 76, 52, 6, 201,
		143, 240, 7, 201, 239, 240, 3, 136, 16, 226, 142, 108, 5, 142, 109, 5,
		96, 41, 15, 240, 245, 142, 218, 10, 142, 240, 10, 142, 255, 10, 140, 219,
		10, 140, 241, 10, 140, 0, 11, 96, 142, 114, 5, 134, 254, 140, 115, 5,
		132, 255, 24, 138, 105, 20, 141, 116, 5, 152, 105, 0, 141, 117, 5, 142,
		118, 5, 200, 200, 140, 119, 5, 160, 19, 177, 254, 141, 108, 5, 141, 109,
		5, 162, 8, 169, 0, 141, 113, 5, 157, 0, 210, 224, 3, 176, 8, 157,
		9, 5, 169, 255, 157, 57, 5, 202, 16, 233, 169, 128, 162, 3, 157, 75,
		5, 202, 16, 250, 96, 169, 1, 141, 113, 5, 169, 0, 240, 238, 41, 3,
		201, 3, 240, 240, 224, 64, 176, 236, 192, 26, 176, 232, 170, 169, 128, 157,
		75, 5, 169, 0, 157, 57, 5, 157, 60, 5, 157, 63, 5, 173, 111, 5,
		157, 12, 5, 173, 112, 5, 10, 10, 10, 133, 254, 24, 173, 114, 5, 105,
		48, 72, 173, 115, 5, 105, 1, 168, 104, 24, 101, 254, 157, 97, 5, 152,
		105, 0, 157, 100, 5, 24, 173, 114, 5, 105, 148, 133, 254, 173, 115, 5,
		105, 0, 133, 255, 173, 112, 5, 10, 109, 112, 5, 10, 168, 177, 254, 157,
		79, 5, 200, 177, 254, 157, 82, 5, 41, 7, 141, 110, 5, 200, 177, 254,
		157, 85, 5, 200, 177, 254, 157, 88, 5, 200, 177, 254, 157, 91, 5, 200,
		177, 254, 157, 94, 5, 160, 0, 173, 110, 5, 201, 3, 208, 2, 160, 2,
		201, 7, 208, 2, 160, 4, 185, 175, 11, 133, 254, 185, 176, 11, 133, 255,
		189, 85, 5, 74, 74, 74, 74, 24, 109, 111, 5, 141, 111, 5, 141, 194,
		7, 168, 173, 110, 5, 201, 7, 208, 15, 152, 10, 168, 177, 254, 157, 45,
		5, 200, 140, 111, 5, 76, 131, 7, 177, 254, 157, 45, 5, 189, 85, 5,
		41, 15, 24, 109, 111, 5, 141, 111, 5, 172, 111, 5, 173, 110, 5, 201,
		5, 8, 177, 254, 40, 240, 8, 221, 45, 5, 208, 3, 56, 233, 1, 157,
		48, 5, 189, 79, 5, 72, 41, 3, 168, 185, 181, 11, 157, 54, 5, 104,
		74, 74, 74, 74, 160, 62, 201, 15, 240, 16, 160, 55, 201, 14, 240, 10,
		160, 48, 201, 13, 240, 4, 24, 105, 0, 168, 185, 185, 11, 157, 51, 5,
		96, 216, 165, 252, 72, 165, 253, 72, 165, 254, 72, 165, 255, 72, 173, 113,
		5, 208, 3, 76, 2, 11, 173, 78, 5, 240, 3, 76, 107, 9, 173, 108,
		5, 205, 109, 5, 240, 3, 76, 88, 9, 173, 103, 5, 240, 3, 76, 220,
		8, 162, 2, 188, 75, 5, 48, 3, 157, 75, 5, 157, 69, 5, 202, 16,
		242, 173, 118, 5, 133, 252, 173, 119, 5, 133, 253, 172, 104, 5, 132, 254,
		204, 106, 5, 208, 25, 173, 107, 5, 240, 20, 173, 104, 5, 172, 105, 5,
		140, 104, 5, 206, 107, 5, 208, 232, 141, 104, 5, 168, 16, 226, 162, 0,
		177, 252, 201, 254, 208, 14, 172, 104, 5, 200, 196, 254, 240, 67, 140, 104,
		5, 76, 26, 8, 157, 66, 5, 24, 152, 105, 85, 168, 232, 224, 3, 144,
		223, 172, 104, 5, 177, 252, 16, 122, 201, 255, 240, 118, 74, 74, 74, 41,
		14, 170, 189, 161, 11, 141, 126, 8, 189, 162, 11, 141, 127, 8, 173, 67,
		5, 133, 255, 32, 147, 8, 140, 104, 5, 192, 85, 176, 4, 196, 254, 208,
		143, 164, 254, 140, 104, 5, 76, 2, 11, 32, 148, 6, 160, 255, 96, 48,
		251, 168, 96, 48, 247, 56, 152, 229, 255, 168, 96, 48, 239, 24, 152, 101,
		255, 168, 96, 48, 231, 141, 108, 5, 141, 109, 5, 200, 96, 48, 221, 173,
		68, 5, 48, 216, 141, 107, 5, 200, 140, 105, 5, 24, 152, 101, 255, 141,
		106, 5, 96, 136, 48, 10, 177, 252, 201, 143, 240, 4, 201, 239, 208, 243,
		200, 96, 162, 2, 189, 72, 5, 240, 5, 222, 72, 5, 16, 99, 189, 75,
		5, 208, 94, 188, 66, 5, 192, 64, 176, 87, 173, 116, 5, 133, 252, 173,
		117, 5, 133, 253, 177, 252, 133, 254, 24, 152, 105, 64, 168, 177, 252, 133,
		255, 37, 254, 201, 255, 240, 58, 188, 69, 5, 177, 254, 41, 192, 208, 12,
		177, 254, 41, 63, 157, 15, 5, 254, 69, 5, 16, 235, 201, 64, 208, 19,
		177, 254, 41, 63, 141, 111, 5, 189, 15, 5, 141, 112, 5, 32, 188, 6,
		76, 72, 9, 201, 128, 208, 10, 177, 254, 41, 63, 157, 72, 5, 254, 69,
		5, 202, 16, 144, 174, 103, 5, 232, 138, 41, 63, 141, 103, 5, 206, 109,
		5, 208, 14, 173, 108, 5, 141, 109, 5, 173, 103, 5, 208, 3, 238, 104,
		5, 172, 48, 5, 173, 82, 5, 41, 7, 201, 5, 240, 4, 201, 6, 208,
		1, 136, 140, 39, 5, 160, 0, 201, 5, 240, 4, 201, 6, 208, 2, 160,
		2, 201, 7, 208, 2, 160, 40, 140, 44, 5, 162, 2, 189, 82, 5, 41,
		224, 157, 40, 5, 189, 97, 5, 133, 252, 189, 100, 5, 133, 253, 189, 57,
		5, 201, 255, 240, 54, 201, 15, 208, 32, 189, 63, 5, 240, 45, 222, 63,
		5, 189, 63, 5, 208, 37, 188, 9, 5, 240, 1, 136, 152, 157, 9, 5,
		189, 88, 5, 157, 63, 5, 76, 229, 9, 189, 57, 5, 74, 168, 177, 252,
		144, 4, 74, 74, 74, 74, 41, 15, 157, 9, 5, 188, 45, 5, 189, 82,
		5, 41, 7, 201, 1, 208, 31, 136, 152, 200, 221, 48, 5, 8, 169, 1,
		40, 208, 2, 10, 10, 61, 60, 5, 240, 12, 188, 48, 5, 192, 255, 208,
		5, 169, 0, 157, 9, 5, 152, 157, 36, 5, 169, 1, 141, 110, 5, 189,
		57, 5, 201, 15, 240, 56, 41, 7, 168, 185, 205, 12, 133, 254, 189, 57,
		5, 41, 8, 8, 138, 40, 24, 240, 2, 105, 3, 168, 185, 91, 5, 37,
		254, 240, 27, 189, 51, 5, 157, 36, 5, 142, 110, 5, 202, 16, 8, 141,
		39, 5, 169, 0, 141, 44, 5, 232, 189, 54, 5, 157, 40, 5, 189, 57,
		5, 41, 15, 201, 15, 240, 16, 254, 57, 5, 189, 57, 5, 201, 15, 208,
		6, 189, 88, 5, 157, 63, 5, 189, 75, 5, 16, 10, 189, 9, 5, 208,
		5, 169, 64, 157, 75, 5, 254, 60, 5, 160, 0, 189, 82, 5, 74, 74,
		74, 74, 144, 1, 136, 74, 144, 1, 200, 24, 152, 125, 45, 5, 157, 45,
		5, 189, 48, 5, 201, 255, 208, 2, 160, 0, 24, 152, 125, 48, 5, 157,
		48, 5, 202, 48, 3, 76, 150, 9, 173, 40, 5, 141, 43, 5, 173, 82,
		5, 41, 7, 170, 160, 3, 173, 110, 5, 240, 3, 188, 213, 12, 152, 72,
		185, 185, 12, 8, 41, 127, 170, 152, 41, 3, 10, 168, 189, 36, 5, 153,
		0, 210, 200, 189, 9, 5, 224, 3, 208, 3, 173, 9, 5, 29, 40, 5,
		40, 16, 2, 169, 0, 153, 0, 210, 104, 168, 136, 41, 3, 208, 207, 160,
		8, 173, 44, 5, 153, 0, 210, 24, 104, 133, 255, 104, 133, 254, 104, 133,
		253, 104, 133, 252, 96, 104, 170, 240, 78, 201, 2, 240, 6, 104, 104, 202,
		208, 251, 96, 165, 20, 197, 20, 240, 252, 173, 36, 2, 201, 134, 208, 7,
		173, 37, 2, 201, 11, 240, 230, 173, 36, 2, 141, 143, 11, 173, 37, 2,
		141, 144, 11, 169, 134, 141, 36, 2, 169, 11, 141, 37, 2, 104, 104, 240,
		3, 56, 233, 1, 141, 93, 11, 104, 168, 104, 170, 169, 112, 32, 120, 5,
		169, 0, 162, 0, 76, 120, 5, 165, 20, 197, 20, 240, 252, 173, 36, 2,
		201, 134, 208, 174, 173, 37, 2, 201, 11, 208, 167, 173, 143, 11, 141, 36,
		2, 173, 144, 11, 141, 37, 2, 169, 64, 76, 120, 5, 32, 203, 7, 144,
		3, 32, 117, 11, 76, 255, 255, 178, 5, 221, 5, 168, 6, 59, 6, 123,
		6, 148, 6, 159, 6, 82, 6, 147, 8, 153, 8, 157, 8, 165, 8, 173,
		8, 183, 8, 205, 8, 185, 11, 250, 11, 59, 12, 128, 160, 32, 64, 255,
		241, 228, 215, 203, 192, 181, 170, 161, 152, 143, 135, 127, 120, 114, 107, 101,
		95, 90, 85, 80, 75, 71, 67, 63, 60, 56, 53, 50, 47, 44, 42, 39,
		37, 35, 33, 31, 29, 28, 26, 24, 23, 22, 20, 19, 18, 17, 16, 15,
		14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0,
		0, 0, 0, 0, 242, 233, 218, 206, 191, 182, 170, 161, 152, 143, 137, 128,
		122, 113, 107, 101, 95, 0, 86, 80, 103, 96, 90, 85, 81, 76, 72, 67,
		63, 61, 57, 52, 51, 57, 45, 42, 40, 37, 36, 33, 31, 30, 0, 0,
		15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
		0, 56, 11, 140, 10, 0, 10, 106, 9, 232, 8, 106, 8, 239, 7, 128,
		7, 8, 7, 174, 6, 70, 6, 230, 5, 149, 5, 65, 5, 246, 4, 176,
		4, 110, 4, 48, 4, 246, 3, 187, 3, 132, 3, 82, 3, 34, 3, 244,
		2, 200, 2, 160, 2, 122, 2, 85, 2, 52, 2, 20, 2, 245, 1, 216,
		1, 189, 1, 164, 1, 141, 1, 119, 1, 96, 1, 78, 1, 56, 1, 39,
		1, 21, 1, 6, 1, 247, 0, 232, 0, 219, 0, 207, 0, 195, 0, 184,
		0, 172, 0, 162, 0, 154, 0, 144, 0, 136, 0, 127, 0, 120, 0, 112,
		0, 106, 0, 100, 0, 94, 0, 87, 0, 82, 0, 50, 0, 10, 0, 0,
		1, 2, 131, 0, 1, 2, 3, 1, 0, 2, 131, 1, 0, 2, 3, 1,
		2, 128, 3, 128, 64, 32, 16, 8, 4, 2, 1, 3, 3, 3, 3, 7,
		11, 15, 19 ]);
	static cmr_obx = new Uint8Array([
		255, 255, 0, 5, 220, 12, 76, 15, 11, 76, 120, 5, 76, 203, 7, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 160, 227, 237, 227, 160, 240, 236, 225,
		249, 229, 242, 160, 246, 160, 178, 174, 177, 160, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255,
		255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 128, 128, 128, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 141, 110,
		5, 142, 111, 5, 140, 112, 5, 41, 112, 74, 74, 74, 170, 189, 145, 11,
		141, 169, 5, 189, 146, 11, 141, 170, 5, 169, 3, 141, 15, 210, 216, 165,
		254, 72, 165, 255, 72, 172, 112, 5, 174, 111, 5, 173, 110, 5, 32, 178,
		5, 104, 133, 255, 104, 133, 254, 96, 173, 118, 5, 133, 254, 173, 119, 5,
		133, 255, 160, 0, 138, 240, 28, 177, 254, 201, 143, 240, 4, 201, 239, 208,
		12, 202, 208, 9, 200, 192, 84, 176, 9, 152, 170, 16, 6, 200, 192, 84,
		144, 229, 96, 142, 104, 5, 32, 123, 6, 169, 0, 162, 9, 157, 69, 5,
		202, 16, 250, 141, 103, 5, 169, 1, 141, 113, 5, 169, 255, 141, 106, 5,
		173, 114, 5, 133, 254, 173, 115, 5, 133, 255, 160, 19, 177, 254, 170, 173,
		118, 5, 133, 254, 173, 119, 5, 133, 255, 172, 104, 5, 177, 254, 201, 207,
		208, 13, 152, 24, 105, 85, 168, 177, 254, 48, 15, 170, 76, 52, 6, 201,
		143, 240, 7, 201, 239, 240, 3, 136, 16, 226, 142, 108, 5, 142, 109, 5,
		96, 41, 15, 240, 245, 142, 218, 10, 142, 240, 10, 142, 255, 10, 140, 219,
		10, 140, 241, 10, 140, 0, 11, 96, 142, 114, 5, 134, 254, 140, 115, 5,
		132, 255, 24, 138, 105, 20, 141, 116, 5, 152, 105, 0, 141, 117, 5, 142,
		118, 5, 200, 200, 140, 119, 5, 160, 19, 177, 254, 141, 108, 5, 141, 109,
		5, 162, 8, 169, 0, 141, 113, 5, 157, 0, 210, 224, 3, 176, 8, 157,
		9, 5, 169, 255, 157, 57, 5, 202, 16, 233, 169, 128, 162, 3, 157, 75,
		5, 202, 16, 250, 96, 169, 1, 141, 113, 5, 169, 0, 240, 238, 41, 3,
		201, 3, 240, 240, 224, 64, 176, 236, 192, 26, 176, 232, 170, 169, 128, 157,
		75, 5, 169, 0, 157, 57, 5, 157, 60, 5, 157, 63, 5, 173, 111, 5,
		157, 12, 5, 173, 112, 5, 10, 10, 10, 133, 254, 24, 173, 114, 5, 105,
		48, 72, 173, 115, 5, 105, 1, 168, 104, 24, 101, 254, 157, 97, 5, 152,
		105, 0, 157, 100, 5, 24, 173, 114, 5, 105, 148, 133, 254, 173, 115, 5,
		105, 0, 133, 255, 173, 112, 5, 10, 109, 112, 5, 10, 168, 177, 254, 157,
		79, 5, 200, 177, 254, 157, 82, 5, 41, 7, 141, 110, 5, 200, 177, 254,
		157, 85, 5, 200, 177, 254, 157, 88, 5, 200, 177, 254, 157, 91, 5, 200,
		177, 254, 157, 94, 5, 160, 0, 173, 110, 5, 201, 3, 208, 2, 160, 2,
		201, 7, 208, 2, 160, 4, 185, 175, 11, 133, 254, 185, 176, 11, 133, 255,
		189, 85, 5, 74, 74, 74, 74, 24, 109, 111, 5, 141, 111, 5, 141, 194,
		7, 168, 173, 110, 5, 201, 7, 208, 15, 152, 10, 168, 177, 254, 157, 45,
		5, 200, 140, 111, 5, 76, 131, 7, 177, 254, 157, 45, 5, 189, 85, 5,
		41, 15, 24, 109, 111, 5, 141, 111, 5, 172, 111, 5, 173, 110, 5, 201,
		5, 8, 177, 254, 40, 240, 8, 221, 45, 5, 208, 3, 56, 233, 1, 157,
		48, 5, 189, 79, 5, 72, 41, 3, 168, 185, 181, 11, 157, 54, 5, 104,
		74, 74, 74, 74, 160, 62, 201, 15, 240, 16, 160, 55, 201, 14, 240, 10,
		160, 48, 201, 13, 240, 4, 24, 105, 0, 168, 185, 185, 11, 157, 51, 5,
		96, 216, 165, 252, 72, 165, 253, 72, 165, 254, 72, 165, 255, 72, 173, 113,
		5, 208, 3, 76, 2, 11, 173, 78, 5, 240, 3, 76, 107, 9, 173, 108,
		5, 205, 109, 5, 240, 3, 76, 88, 9, 173, 103, 5, 240, 3, 76, 220,
		8, 162, 2, 188, 75, 5, 48, 3, 157, 75, 5, 157, 69, 5, 202, 16,
		242, 173, 118, 5, 133, 252, 173, 119, 5, 133, 253, 172, 104, 5, 132, 254,
		204, 106, 5, 208, 25, 173, 107, 5, 240, 20, 173, 104, 5, 172, 105, 5,
		140, 104, 5, 206, 107, 5, 208, 232, 141, 104, 5, 168, 16, 226, 162, 0,
		177, 252, 201, 254, 208, 14, 172, 104, 5, 200, 196, 254, 240, 67, 140, 104,
		5, 76, 26, 8, 157, 66, 5, 24, 152, 105, 85, 168, 232, 224, 3, 144,
		223, 172, 104, 5, 177, 252, 16, 122, 201, 255, 240, 118, 74, 74, 74, 41,
		14, 170, 189, 161, 11, 141, 126, 8, 189, 162, 11, 141, 127, 8, 173, 67,
		5, 133, 255, 32, 147, 8, 140, 104, 5, 192, 85, 176, 4, 196, 254, 208,
		143, 164, 254, 140, 104, 5, 76, 2, 11, 32, 148, 6, 160, 255, 96, 48,
		251, 168, 96, 48, 247, 56, 152, 229, 255, 168, 96, 48, 239, 24, 152, 101,
		255, 168, 96, 48, 231, 141, 108, 5, 141, 109, 5, 200, 96, 48, 221, 173,
		68, 5, 48, 216, 141, 107, 5, 200, 140, 105, 5, 24, 152, 101, 255, 141,
		106, 5, 96, 136, 48, 10, 177, 252, 201, 143, 240, 4, 201, 239, 208, 243,
		200, 96, 162, 2, 189, 72, 5, 240, 5, 222, 72, 5, 16, 99, 189, 75,
		5, 208, 94, 188, 66, 5, 192, 64, 176, 87, 173, 116, 5, 133, 252, 173,
		117, 5, 133, 253, 177, 252, 133, 254, 24, 152, 105, 64, 168, 177, 252, 133,
		255, 37, 254, 201, 255, 240, 58, 188, 69, 5, 177, 254, 41, 192, 208, 12,
		177, 254, 41, 63, 157, 15, 5, 254, 69, 5, 16, 235, 201, 64, 208, 19,
		177, 254, 41, 63, 141, 111, 5, 189, 15, 5, 141, 112, 5, 32, 188, 6,
		76, 72, 9, 201, 128, 208, 10, 177, 254, 41, 63, 157, 72, 5, 254, 69,
		5, 202, 16, 144, 174, 103, 5, 232, 138, 41, 63, 141, 103, 5, 206, 109,
		5, 208, 14, 173, 108, 5, 141, 109, 5, 173, 103, 5, 208, 3, 238, 104,
		5, 172, 48, 5, 173, 82, 5, 41, 7, 201, 5, 240, 4, 201, 6, 208,
		1, 136, 140, 39, 5, 160, 0, 201, 5, 240, 4, 201, 6, 208, 2, 160,
		2, 201, 7, 208, 2, 160, 40, 140, 44, 5, 162, 2, 189, 82, 5, 41,
		224, 157, 40, 5, 189, 97, 5, 133, 252, 189, 100, 5, 133, 253, 189, 57,
		5, 201, 255, 240, 54, 201, 15, 208, 32, 189, 63, 5, 240, 45, 222, 63,
		5, 189, 63, 5, 208, 37, 188, 9, 5, 240, 1, 136, 152, 157, 9, 5,
		189, 88, 5, 157, 63, 5, 76, 229, 9, 189, 57, 5, 74, 168, 177, 252,
		144, 4, 74, 74, 74, 74, 41, 15, 157, 9, 5, 188, 45, 5, 189, 82,
		5, 41, 7, 201, 1, 208, 31, 136, 152, 200, 221, 48, 5, 8, 169, 1,
		40, 208, 2, 10, 10, 61, 60, 5, 240, 12, 188, 48, 5, 192, 255, 208,
		5, 169, 0, 157, 9, 5, 152, 157, 36, 5, 169, 1, 141, 110, 5, 189,
		57, 5, 201, 15, 240, 56, 41, 7, 168, 185, 205, 12, 133, 254, 189, 57,
		5, 41, 8, 8, 138, 40, 24, 240, 2, 105, 3, 168, 185, 91, 5, 37,
		254, 240, 27, 189, 51, 5, 157, 36, 5, 142, 110, 5, 202, 16, 8, 141,
		39, 5, 169, 0, 141, 44, 5, 232, 189, 54, 5, 157, 40, 5, 189, 57,
		5, 41, 15, 201, 15, 240, 16, 254, 57, 5, 189, 57, 5, 201, 15, 208,
		6, 189, 88, 5, 157, 63, 5, 189, 75, 5, 16, 10, 189, 9, 5, 208,
		5, 169, 64, 157, 75, 5, 254, 60, 5, 160, 0, 189, 82, 5, 74, 74,
		74, 74, 144, 1, 136, 74, 144, 1, 200, 24, 152, 125, 45, 5, 157, 45,
		5, 189, 48, 5, 201, 255, 208, 2, 160, 0, 24, 152, 125, 48, 5, 157,
		48, 5, 202, 48, 3, 76, 150, 9, 173, 40, 5, 141, 43, 5, 173, 82,
		5, 41, 7, 170, 160, 3, 173, 110, 5, 240, 3, 188, 213, 12, 152, 72,
		185, 185, 12, 8, 41, 127, 170, 152, 41, 3, 10, 168, 189, 36, 5, 153,
		0, 210, 200, 189, 9, 5, 224, 3, 208, 3, 173, 9, 5, 29, 40, 5,
		40, 16, 2, 169, 0, 153, 0, 210, 104, 168, 136, 41, 3, 208, 207, 160,
		8, 173, 44, 5, 153, 0, 210, 24, 104, 133, 255, 104, 133, 254, 104, 133,
		253, 104, 133, 252, 96, 104, 170, 240, 78, 201, 2, 240, 6, 104, 104, 202,
		208, 251, 96, 165, 20, 197, 20, 240, 252, 173, 36, 2, 201, 134, 208, 7,
		173, 37, 2, 201, 11, 240, 230, 173, 36, 2, 141, 143, 11, 173, 37, 2,
		141, 144, 11, 169, 134, 141, 36, 2, 169, 11, 141, 37, 2, 104, 104, 240,
		3, 56, 233, 1, 141, 93, 11, 104, 168, 104, 170, 169, 112, 32, 120, 5,
		169, 0, 162, 0, 76, 120, 5, 165, 20, 197, 20, 240, 252, 173, 36, 2,
		201, 134, 208, 174, 173, 37, 2, 201, 11, 208, 167, 173, 143, 11, 141, 36,
		2, 173, 144, 11, 141, 37, 2, 169, 64, 76, 120, 5, 32, 203, 7, 144,
		3, 32, 117, 11, 76, 255, 255, 178, 5, 221, 5, 168, 6, 59, 6, 123,
		6, 148, 6, 159, 6, 82, 6, 147, 8, 153, 8, 157, 8, 165, 8, 173,
		8, 183, 8, 205, 8, 185, 11, 250, 11, 59, 12, 128, 160, 32, 64, 255,
		241, 228, 215, 203, 192, 181, 170, 161, 152, 143, 135, 127, 120, 114, 107, 101,
		95, 90, 85, 80, 75, 71, 67, 63, 60, 56, 53, 50, 47, 44, 42, 39,
		37, 35, 33, 31, 29, 28, 26, 24, 23, 22, 20, 19, 18, 17, 16, 15,
		14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0,
		0, 0, 0, 0, 242, 233, 218, 206, 191, 182, 170, 161, 152, 143, 137, 128,
		122, 113, 107, 101, 95, 92, 86, 80, 77, 71, 68, 65, 62, 56, 53, 136,
		127, 121, 115, 108, 103, 96, 90, 85, 81, 76, 72, 67, 63, 61, 57, 52,
		51, 48, 45, 42, 40, 37, 36, 33, 31, 30, 5, 4, 3, 2, 1, 0,
		0, 56, 11, 140, 10, 0, 10, 106, 9, 232, 8, 106, 8, 239, 7, 128,
		7, 8, 7, 174, 6, 70, 6, 230, 5, 149, 5, 65, 5, 246, 4, 176,
		4, 110, 4, 48, 4, 246, 3, 187, 3, 132, 3, 82, 3, 34, 3, 244,
		2, 200, 2, 160, 2, 122, 2, 85, 2, 52, 2, 20, 2, 245, 1, 216,
		1, 189, 1, 164, 1, 141, 1, 119, 1, 96, 1, 78, 1, 56, 1, 39,
		1, 21, 1, 6, 1, 247, 0, 232, 0, 219, 0, 207, 0, 195, 0, 184,
		0, 172, 0, 162, 0, 154, 0, 144, 0, 136, 0, 127, 0, 120, 0, 112,
		0, 106, 0, 100, 0, 94, 0, 87, 0, 82, 0, 50, 0, 10, 0, 0,
		1, 2, 131, 0, 1, 2, 3, 1, 0, 2, 131, 1, 0, 2, 3, 1,
		2, 128, 3, 128, 64, 32, 16, 8, 4, 2, 1, 3, 3, 3, 3, 7,
		11, 15, 19 ]);
	static cms_obx = new Uint8Array([
		255, 255, 0, 5, 190, 15, 234, 234, 234, 76, 21, 8, 76, 96, 15, 35,
		5, 169, 5, 173, 5, 184, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 128, 128, 128, 128, 128, 128, 0, 0, 0, 0, 0, 0, 255,
		255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 130, 0, 0, 6, 6, 0,
		128, 20, 128, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15,
		15, 0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0, 0,
		1, 2, 131, 0, 1, 2, 3, 1, 0, 2, 131, 1, 0, 2, 3, 1,
		2, 128, 3, 128, 64, 32, 16, 8, 4, 2, 1, 75, 8, 118, 8, 133,
		9, 19, 9, 80, 9, 110, 9, 124, 9, 26, 9, 128, 160, 32, 64, 255,
		241, 228, 215, 203, 192, 181, 170, 161, 152, 143, 135, 127, 120, 114, 107, 101,
		95, 90, 85, 80, 75, 71, 67, 63, 60, 56, 53, 50, 47, 44, 42, 39,
		37, 35, 33, 31, 29, 28, 26, 24, 23, 22, 20, 19, 18, 17, 16, 15,
		14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0,
		0, 0, 0, 0, 242, 233, 218, 206, 191, 182, 170, 161, 152, 143, 137, 128,
		122, 113, 107, 101, 95, 0, 86, 80, 103, 96, 90, 85, 81, 76, 72, 67,
		63, 61, 57, 52, 51, 57, 45, 42, 40, 37, 36, 33, 31, 30, 0, 0,
		15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
		0, 56, 11, 140, 10, 0, 10, 106, 9, 232, 8, 106, 8, 239, 7, 128,
		7, 8, 7, 174, 6, 70, 6, 230, 5, 149, 5, 65, 5, 246, 4, 176,
		4, 110, 4, 48, 4, 246, 3, 187, 3, 132, 3, 82, 3, 34, 3, 244,
		2, 200, 2, 160, 2, 122, 2, 85, 2, 52, 2, 20, 2, 245, 1, 216,
		1, 189, 1, 164, 1, 141, 1, 119, 1, 96, 1, 78, 1, 56, 1, 39,
		1, 21, 1, 6, 1, 247, 0, 232, 0, 219, 0, 207, 0, 195, 0, 184,
		0, 172, 0, 162, 0, 154, 0, 144, 0, 136, 0, 127, 0, 120, 0, 112,
		0, 106, 0, 100, 0, 94, 0, 87, 0, 82, 0, 50, 0, 10, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0,
		0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 0,
		0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 0,
		0, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 0,
		0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 0,
		0, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5, 5, 6, 6, 0,
		0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 0,
		1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 0,
		1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 7, 7, 8, 8, 9, 0,
		1, 1, 2, 3, 3, 4, 5, 5, 6, 7, 7, 8, 9, 9, 10, 0,
		1, 1, 2, 3, 4, 4, 5, 6, 7, 7, 8, 9, 10, 10, 11, 0,
		1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 9, 10, 11, 11, 12, 0,
		1, 2, 3, 4, 5, 5, 6, 7, 8, 9, 10, 10, 11, 12, 13, 0,
		1, 2, 3, 4, 5, 6, 7, 7, 8, 9, 10, 11, 12, 13, 14, 0,
		1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 6,
		12, 12, 12, 18, 12, 28, 12, 38, 12, 50, 12, 79, 12, 233, 5, 42,
		6, 107, 6, 161, 11, 196, 11, 185, 11, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 3, 3, 3, 3, 7, 11, 15, 19, 141, 143, 5, 142, 144,
		5, 140, 145, 5, 41, 112, 74, 74, 74, 170, 169, 3, 141, 15, 210, 189,
		213, 5, 141, 73, 8, 189, 214, 5, 141, 74, 8, 169, 3, 141, 31, 210,
		169, 1, 141, 146, 5, 172, 145, 5, 174, 144, 5, 173, 143, 5, 76, 72,
		8, 173, 147, 5, 133, 252, 173, 148, 5, 133, 253, 160, 0, 138, 240, 28,
		177, 252, 201, 143, 240, 4, 201, 239, 208, 12, 202, 208, 9, 200, 192, 84,
		176, 9, 152, 170, 16, 6, 200, 192, 84, 144, 229, 96, 142, 149, 5, 169,
		0, 162, 5, 157, 17, 5, 157, 23, 5, 157, 29, 5, 202, 16, 244, 141,
		150, 5, 141, 157, 5, 160, 255, 140, 159, 5, 173, 153, 5, 133, 252, 173,
		154, 5, 133, 253, 160, 19, 177, 252, 170, 173, 147, 5, 133, 252, 173, 148,
		5, 133, 253, 172, 149, 5, 152, 72, 169, 15, 141, 169, 5, 141, 170, 5,
		177, 252, 201, 135, 208, 35, 152, 72, 24, 105, 85, 168, 177, 252, 16, 2,
		169, 15, 41, 15, 141, 169, 5, 152, 24, 105, 85, 168, 177, 252, 16, 3,
		173, 169, 5, 41, 15, 141, 170, 5, 104, 76, 243, 8, 177, 252, 201, 143,
		240, 7, 201, 239, 240, 3, 136, 16, 199, 104, 168, 177, 252, 201, 207, 208,
		13, 152, 24, 105, 85, 168, 177, 252, 48, 15, 170, 76, 19, 9, 201, 143,
		240, 7, 201, 239, 240, 3, 136, 16, 226, 142, 151, 5, 142, 152, 5, 96,
		142, 153, 5, 134, 252, 140, 154, 5, 132, 253, 24, 138, 105, 20, 141, 155,
		5, 152, 105, 0, 141, 156, 5, 24, 138, 105, 0, 141, 147, 5, 152, 105,
		2, 141, 148, 5, 160, 19, 177, 252, 141, 151, 5, 141, 152, 5, 162, 3,
		142, 31, 210, 142, 15, 210, 169, 0, 141, 146, 5, 160, 8, 169, 0, 153,
		0, 210, 153, 16, 210, 192, 6, 176, 8, 153, 35, 5, 169, 255, 153, 41,
		5, 136, 16, 233, 169, 128, 162, 5, 157, 29, 5, 202, 16, 250, 141, 157,
		5, 96, 169, 0, 240, 240, 141, 157, 5, 240, 11, 173, 143, 5, 41, 7,
		170, 169, 128, 157, 29, 5, 172, 145, 5, 173, 144, 5, 141, 143, 5, 140,
		145, 5, 169, 0, 157, 83, 5, 157, 41, 5, 157, 77, 5, 152, 10, 10,
		10, 133, 254, 24, 173, 153, 5, 105, 48, 72, 173, 154, 5, 105, 1, 168,
		104, 24, 101, 254, 157, 101, 5, 152, 105, 0, 157, 71, 5, 24, 173, 153,
		5, 105, 148, 133, 252, 173, 154, 5, 105, 0, 133, 253, 173, 145, 5, 10,
		109, 145, 5, 10, 168, 140, 145, 5, 200, 200, 200, 200, 200, 177, 252, 157,
		113, 5, 136, 177, 252, 157, 107, 5, 136, 177, 252, 157, 119, 5, 136, 136,
		177, 252, 157, 59, 5, 160, 0, 41, 7, 201, 3, 208, 2, 160, 2, 201,
		7, 208, 2, 160, 4, 185, 247, 7, 133, 254, 185, 248, 7, 133, 255, 172,
		145, 5, 200, 200, 177, 252, 74, 74, 74, 74, 24, 109, 143, 5, 141, 143,
		5, 141, 159, 10, 168, 189, 59, 5, 41, 7, 201, 7, 208, 15, 152, 10,
		168, 177, 254, 157, 125, 5, 200, 140, 143, 5, 76, 92, 10, 177, 254, 157,
		125, 5, 172, 145, 5, 200, 200, 177, 252, 41, 15, 24, 109, 143, 5, 141,
		143, 5, 172, 143, 5, 189, 59, 5, 41, 7, 201, 5, 8, 177, 254, 40,
		240, 8, 221, 125, 5, 208, 3, 56, 233, 1, 157, 89, 5, 172, 145, 5,
		177, 252, 72, 41, 3, 168, 185, 229, 5, 157, 131, 5, 104, 74, 74, 74,
		74, 160, 62, 201, 15, 240, 16, 160, 55, 201, 14, 240, 10, 160, 48, 201,
		13, 240, 4, 24, 105, 50, 168, 185, 233, 5, 157, 137, 5, 96, 216, 165,
		252, 72, 165, 253, 72, 165, 254, 72, 165, 255, 72, 173, 146, 5, 208, 3,
		76, 51, 15, 173, 157, 5, 240, 3, 76, 229, 12, 173, 152, 5, 205, 151,
		5, 176, 3, 76, 210, 12, 173, 150, 5, 240, 3, 76, 158, 11, 162, 5,
		169, 0, 188, 29, 5, 48, 3, 157, 29, 5, 157, 17, 5, 202, 16, 242,
		173, 147, 5, 133, 252, 173, 148, 5, 133, 253, 172, 149, 5, 140, 161, 5,
		204, 159, 5, 208, 25, 173, 160, 5, 240, 20, 173, 149, 5, 172, 158, 5,
		140, 149, 5, 206, 160, 5, 208, 232, 141, 149, 5, 168, 16, 226, 162, 0,
		177, 252, 201, 254, 240, 28, 157, 53, 5, 230, 253, 177, 252, 198, 253, 201,
		254, 240, 15, 157, 56, 5, 24, 152, 105, 85, 168, 232, 224, 3, 144, 224,
		176, 34, 172, 149, 5, 200, 204, 161, 5, 240, 80, 140, 149, 5, 76, 250,
		10, 104, 41, 14, 170, 189, 253, 7, 141, 135, 11, 189, 254, 7, 141, 136,
		11, 76, 129, 11, 172, 149, 5, 177, 252, 16, 57, 201, 255, 240, 53, 74,
		74, 74, 72, 41, 1, 240, 218, 104, 41, 14, 170, 189, 233, 7, 141, 135,
		11, 189, 234, 7, 141, 136, 11, 173, 54, 5, 133, 254, 32, 134, 11, 140,
		149, 5, 192, 85, 176, 5, 204, 161, 5, 208, 179, 172, 161, 5, 140, 149,
		5, 76, 51, 15, 76, 94, 12, 165, 254, 48, 18, 41, 15, 141, 169, 5,
		173, 55, 5, 16, 3, 173, 169, 5, 41, 15, 141, 170, 5, 200, 96, 165,
		254, 48, 250, 41, 1, 141, 184, 5, 200, 96, 173, 179, 5, 48, 20, 206,
		180, 5, 208, 51, 169, 50, 141, 180, 5, 206, 179, 5, 208, 41, 206, 179,
		5, 200, 96, 165, 254, 48, 214, 141, 180, 5, 238, 180, 5, 165, 254, 48,
		204, 141, 180, 5, 238, 180, 5, 173, 55, 5, 141, 179, 5, 16, 5, 169,
		0, 141, 179, 5, 238, 179, 5, 104, 104, 76, 229, 12, 32, 110, 9, 160,
		255, 96, 165, 254, 48, 249, 168, 96, 165, 254, 48, 243, 56, 152, 229, 254,
		168, 96, 165, 254, 48, 233, 24, 152, 101, 254, 168, 96, 165, 254, 48, 223,
		141, 151, 5, 141, 152, 5, 200, 96, 165, 254, 48, 211, 173, 55, 5, 48,
		206, 200, 140, 158, 5, 24, 152, 101, 254, 141, 159, 5, 173, 55, 5, 141,
		160, 5, 192, 84, 96, 136, 48, 10, 177, 252, 201, 143, 240, 4, 201, 239,
		208, 243, 200, 96, 162, 5, 189, 23, 5, 240, 5, 222, 23, 5, 16, 91,
		189, 29, 5, 208, 86, 188, 53, 5, 192, 64, 176, 79, 173, 155, 5, 133,
		252, 173, 156, 5, 133, 253, 177, 252, 133, 254, 24, 152, 105, 64, 168, 177,
		252, 133, 255, 201, 255, 176, 52, 188, 17, 5, 177, 254, 41, 192, 208, 12,
		177, 254, 41, 63, 157, 47, 5, 254, 17, 5, 16, 235, 201, 64, 208, 13,
		177, 254, 41, 63, 188, 47, 5, 32, 150, 9, 76, 194, 12, 201, 128, 208,
		10, 177, 254, 41, 63, 157, 23, 5, 254, 17, 5, 202, 16, 152, 174, 150,
		5, 232, 138, 41, 63, 141, 150, 5, 206, 152, 5, 208, 14, 173, 151, 5,
		141, 152, 5, 173, 150, 5, 208, 3, 238, 149, 5, 172, 89, 5, 173, 59,
		5, 41, 7, 201, 5, 240, 4, 201, 6, 208, 1, 136, 140, 162, 5, 160,
		0, 201, 5, 240, 4, 201, 6, 208, 2, 160, 2, 201, 7, 208, 2, 160,
		40, 140, 164, 5, 172, 92, 5, 173, 62, 5, 41, 7, 201, 5, 240, 4,
		201, 6, 208, 1, 136, 140, 163, 5, 160, 0, 201, 5, 240, 4, 201, 6,
		208, 2, 160, 2, 201, 7, 208, 2, 160, 40, 140, 165, 5, 162, 5, 189,
		59, 5, 41, 224, 157, 65, 5, 189, 101, 5, 133, 252, 189, 71, 5, 133,
		253, 189, 41, 5, 201, 255, 240, 55, 201, 15, 208, 33, 189, 77, 5, 240,
		46, 222, 77, 5, 189, 77, 5, 208, 38, 188, 35, 5, 240, 1, 136, 152,
		157, 35, 5, 189, 119, 5, 157, 77, 5, 136, 76, 137, 13, 189, 41, 5,
		74, 168, 177, 252, 144, 4, 74, 74, 74, 74, 41, 15, 157, 35, 5, 188,
		125, 5, 189, 59, 5, 41, 7, 201, 1, 208, 31, 136, 152, 200, 221, 89,
		5, 8, 169, 1, 40, 208, 2, 10, 10, 61, 83, 5, 240, 12, 188, 89,
		5, 192, 255, 208, 5, 169, 0, 157, 35, 5, 152, 157, 95, 5, 169, 1,
		141, 168, 5, 189, 41, 5, 201, 15, 240, 76, 41, 7, 168, 185, 205, 5,
		133, 254, 189, 41, 5, 41, 8, 8, 138, 40, 24, 240, 2, 105, 6, 168,
		185, 107, 5, 37, 254, 240, 47, 189, 137, 5, 157, 95, 5, 142, 168, 5,
		202, 224, 2, 240, 15, 224, 255, 208, 22, 141, 162, 5, 169, 0, 141, 164,
		5, 76, 9, 14, 173, 140, 5, 141, 163, 5, 169, 0, 141, 165, 5, 232,
		189, 131, 5, 157, 65, 5, 189, 41, 5, 41, 15, 201, 15, 240, 18, 254,
		41, 5, 189, 41, 5, 41, 15, 201, 15, 208, 6, 189, 119, 5, 157, 77,
		5, 189, 29, 5, 16, 10, 189, 35, 5, 208, 5, 169, 64, 157, 29, 5,
		254, 83, 5, 160, 0, 189, 59, 5, 74, 74, 74, 74, 144, 1, 136, 74,
		144, 1, 200, 24, 152, 125, 125, 5, 157, 125, 5, 189, 89, 5, 201, 255,
		208, 2, 160, 0, 24, 152, 125, 89, 5, 157, 89, 5, 202, 48, 3, 76,
		57, 13, 32, 127, 15, 173, 65, 5, 141, 166, 5, 173, 68, 5, 141, 167,
		5, 173, 59, 5, 41, 7, 32, 185, 15, 152, 72, 185, 185, 5, 8, 41,
		127, 170, 152, 41, 3, 10, 168, 224, 3, 208, 3, 76, 200, 14, 189, 173,
		5, 208, 39, 189, 95, 5, 153, 0, 210, 189, 35, 5, 29, 65, 5, 40,
		16, 2, 169, 0, 153, 1, 210, 104, 168, 136, 41, 3, 240, 3, 76, 131,
		14, 173, 164, 5, 141, 8, 210, 76, 232, 14, 40, 76, 177, 14, 173, 173,
		5, 208, 23, 173, 162, 5, 153, 0, 210, 173, 35, 5, 13, 166, 5, 40,
		16, 2, 169, 0, 153, 1, 210, 76, 177, 14, 40, 76, 177, 14, 173, 62,
		5, 41, 7, 32, 185, 15, 152, 72, 185, 185, 5, 8, 41, 127, 170, 152,
		41, 3, 10, 168, 224, 3, 208, 3, 76, 64, 15, 189, 176, 5, 208, 30,
		189, 98, 5, 153, 16, 210, 189, 38, 5, 29, 68, 5, 40, 16, 2, 169,
		0, 153, 17, 210, 104, 168, 136, 41, 3, 240, 7, 76, 240, 14, 40, 76,
		30, 15, 173, 165, 5, 141, 24, 210, 24, 104, 133, 255, 104, 133, 254, 104,
		133, 253, 104, 133, 252, 96, 173, 176, 5, 208, 23, 173, 163, 5, 153, 16,
		210, 173, 38, 5, 13, 167, 5, 40, 16, 2, 169, 0, 153, 17, 210, 76,
		30, 15, 40, 76, 30, 15, 32, 168, 10, 176, 25, 173, 184, 5, 240, 20,
		173, 157, 5, 141, 183, 5, 169, 1, 141, 157, 5, 32, 168, 10, 173, 183,
		5, 141, 157, 5, 96, 173, 169, 5, 10, 10, 10, 10, 141, 171, 5, 173,
		170, 5, 10, 10, 10, 10, 141, 172, 5, 162, 2, 134, 200, 173, 171, 5,
		29, 35, 5, 170, 189, 233, 6, 166, 200, 157, 35, 5, 173, 172, 5, 29,
		38, 5, 170, 189, 233, 6, 166, 200, 157, 38, 5, 202, 16, 221, 96, 168,
		185, 13, 8, 168, 96 ]);
	static dlt_obx = new Uint8Array([
		255, 255, 0, 4, 70, 12, 255, 241, 228, 215, 203, 192, 181, 170, 161, 152,
		143, 135, 127, 121, 114, 107, 101, 95, 90, 85, 80, 75, 71, 67, 63, 60,
		56, 53, 50, 47, 44, 42, 39, 37, 35, 33, 31, 29, 28, 26, 24, 23,
		22, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
		5, 4, 255, 241, 228, 215, 242, 233, 218, 206, 191, 182, 170, 161, 152, 143,
		137, 128, 122, 113, 107, 101, 95, 92, 86, 80, 103, 96, 90, 85, 81, 76,
		72, 67, 63, 61, 57, 52, 51, 48, 45, 42, 40, 37, 36, 33, 31, 30,
		28, 27, 25, 0, 22, 21, 0, 10, 9, 8, 7, 6, 5, 4, 3, 2,
		1, 0, 242, 233, 218, 206, 242, 233, 218, 206, 191, 182, 170, 161, 152, 143,
		137, 128, 122, 113, 107, 101, 95, 92, 86, 80, 103, 96, 90, 85, 81, 76,
		72, 67, 63, 61, 57, 52, 51, 48, 45, 42, 40, 37, 36, 33, 31, 30,
		28, 27, 25, 0, 22, 21, 0, 10, 9, 8, 7, 6, 5, 4, 3, 2,
		1, 0, 242, 233, 218, 206, 255, 241, 228, 216, 202, 192, 181, 171, 162, 153,
		142, 135, 127, 120, 115, 108, 102, 97, 90, 85, 81, 75, 72, 67, 63, 60,
		57, 52, 51, 48, 45, 42, 40, 37, 36, 33, 31, 30, 28, 27, 25, 23,
		22, 21, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
		5, 4, 3, 2, 1, 255, 76, 9, 5, 76, 200, 5, 76, 183, 5, 136,
		140, 54, 3, 169, 126, 141, 53, 3, 162, 6, 142, 51, 3, 162, 1, 142,
		52, 3, 32, 51, 5, 32, 95, 5, 32, 163, 5, 32, 139, 5, 169, 1,
		141, 50, 3, 169, 3, 141, 15, 210, 96, 162, 0, 160, 32, 142, 48, 3,
		140, 49, 3, 160, 0, 173, 48, 3, 153, 0, 2, 173, 49, 3, 153, 64,
		2, 173, 48, 3, 24, 105, 128, 141, 48, 3, 144, 3, 238, 49, 3, 200,
		192, 64, 208, 225, 96, 162, 0, 160, 68, 142, 48, 3, 140, 49, 3, 160,
		0, 173, 48, 3, 153, 128, 2, 173, 49, 3, 153, 160, 2, 173, 48, 3,
		24, 105, 64, 141, 48, 3, 144, 3, 238, 49, 3, 200, 192, 32, 208, 225,
		96, 173, 0, 76, 41, 1, 74, 106, 106, 168, 162, 0, 185, 128, 4, 157,
		64, 4, 200, 232, 224, 64, 208, 244, 96, 160, 3, 169, 0, 153, 40, 3,
		153, 32, 3, 153, 36, 3, 153, 44, 3, 136, 16, 241, 96, 169, 0, 141,
		50, 3, 160, 7, 169, 0, 153, 0, 210, 136, 16, 250, 96, 96, 173, 50,
		3, 240, 250, 173, 40, 3, 13, 41, 3, 13, 42, 3, 13, 43, 3, 141,
		8, 210, 174, 36, 3, 172, 32, 3, 142, 0, 210, 140, 1, 210, 174, 37,
		3, 172, 33, 3, 142, 2, 210, 140, 3, 210, 174, 38, 3, 172, 34, 3,
		142, 4, 210, 140, 5, 210, 174, 39, 3, 172, 35, 3, 142, 6, 210, 140,
		7, 210, 206, 52, 3, 208, 74, 173, 51, 3, 141, 52, 3, 238, 53, 3,
		238, 53, 3, 16, 28, 238, 54, 3, 169, 0, 141, 53, 3, 32, 199, 6,
		173, 4, 3, 13, 5, 3, 13, 6, 3, 13, 7, 3, 208, 3, 76, 183,
		5, 173, 4, 3, 240, 3, 32, 97, 7, 173, 5, 3, 240, 3, 32, 192,
		7, 173, 6, 3, 240, 3, 32, 31, 8, 173, 7, 3, 240, 3, 32, 126,
		8, 173, 4, 3, 240, 8, 173, 44, 3, 240, 3, 32, 221, 8, 173, 5,
		3, 240, 8, 173, 45, 3, 240, 3, 32, 206, 9, 173, 6, 3, 240, 8,
		173, 46, 3, 240, 3, 32, 191, 10, 173, 7, 3, 240, 8, 173, 47, 3,
		240, 3, 32, 131, 11, 96, 192, 67, 144, 14, 169, 0, 141, 4, 3, 141,
		32, 3, 141, 40, 3, 76, 230, 6, 192, 66, 208, 15, 189, 128, 64, 141,
		51, 3, 141, 52, 3, 238, 54, 3, 76, 199, 6, 192, 65, 208, 9, 189,
		128, 64, 141, 54, 3, 76, 199, 6, 104, 104, 76, 183, 5, 174, 54, 3,
		188, 0, 64, 192, 64, 176, 191, 189, 128, 64, 141, 24, 3, 185, 0, 2,
		133, 224, 185, 64, 2, 133, 225, 169, 1, 141, 4, 3, 188, 0, 65, 192,
		64, 176, 78, 189, 128, 65, 141, 25, 3, 185, 0, 2, 133, 226, 185, 64,
		2, 133, 227, 169, 1, 141, 5, 3, 188, 0, 66, 192, 64, 176, 63, 189,
		128, 66, 141, 26, 3, 185, 0, 2, 133, 228, 185, 64, 2, 133, 229, 169,
		1, 141, 6, 3, 188, 0, 67, 192, 64, 176, 48, 189, 128, 67, 141, 27,
		3, 185, 0, 2, 133, 230, 185, 64, 2, 133, 231, 169, 1, 141, 7, 3,
		96, 169, 0, 141, 5, 3, 141, 33, 3, 141, 41, 3, 240, 186, 169, 0,
		141, 6, 3, 141, 34, 3, 141, 42, 3, 240, 201, 169, 0, 141, 7, 3,
		141, 35, 3, 141, 43, 3, 96, 172, 53, 3, 177, 224, 48, 11, 200, 177,
		224, 48, 1, 96, 104, 104, 76, 31, 6, 24, 109, 24, 3, 41, 127, 141,
		8, 3, 169, 15, 141, 0, 3, 141, 44, 3, 200, 177, 224, 170, 189, 160,
		2, 133, 233, 133, 241, 133, 249, 189, 128, 2, 133, 232, 73, 16, 133, 240,
		73, 48, 133, 248, 160, 49, 177, 232, 141, 12, 3, 160, 51, 177, 232, 41,
		127, 141, 16, 3, 169, 0, 141, 20, 3, 141, 28, 3, 160, 48, 177, 232,
		41, 213, 141, 40, 3, 96, 172, 53, 3, 177, 226, 48, 11, 200, 177, 226,
		48, 1, 96, 104, 104, 76, 31, 6, 24, 109, 25, 3, 41, 127, 141, 9,
		3, 169, 15, 141, 1, 3, 141, 45, 3, 200, 177, 226, 170, 189, 160, 2,
		133, 235, 133, 243, 133, 251, 189, 128, 2, 133, 234, 73, 16, 133, 242, 73,
		48, 133, 250, 160, 49, 177, 234, 141, 13, 3, 160, 51, 177, 234, 41, 127,
		141, 17, 3, 169, 0, 141, 21, 3, 141, 29, 3, 160, 48, 177, 234, 41,
		131, 141, 41, 3, 96, 172, 53, 3, 177, 228, 48, 11, 200, 177, 228, 48,
		1, 96, 104, 104, 76, 31, 6, 24, 109, 26, 3, 41, 127, 141, 10, 3,
		169, 15, 141, 2, 3, 141, 46, 3, 200, 177, 228, 170, 189, 160, 2, 133,
		237, 133, 245, 133, 253, 189, 128, 2, 133, 236, 73, 16, 133, 244, 73, 48,
		133, 252, 160, 49, 177, 236, 141, 14, 3, 160, 51, 177, 236, 41, 127, 141,
		18, 3, 169, 0, 141, 22, 3, 141, 30, 3, 160, 48, 177, 236, 41, 169,
		141, 42, 3, 96, 172, 53, 3, 177, 230, 48, 11, 200, 177, 230, 48, 1,
		96, 104, 104, 76, 31, 6, 24, 109, 27, 3, 41, 127, 141, 11, 3, 169,
		15, 141, 3, 3, 141, 47, 3, 200, 177, 230, 170, 189, 160, 2, 133, 239,
		133, 247, 133, 255, 189, 128, 2, 133, 238, 73, 16, 133, 246, 73, 48, 133,
		254, 160, 49, 177, 238, 141, 15, 3, 160, 51, 177, 238, 41, 127, 141, 19,
		3, 169, 0, 141, 23, 3, 141, 31, 3, 160, 48, 177, 238, 41, 129, 141,
		43, 3, 96, 172, 0, 3, 48, 70, 177, 232, 141, 32, 3, 177, 240, 208,
		9, 32, 108, 9, 206, 0, 3, 76, 79, 9, 201, 1, 240, 39, 201, 3,
		208, 16, 173, 8, 3, 24, 113, 248, 170, 173, 28, 3, 141, 55, 3, 76,
		24, 9, 173, 28, 3, 24, 113, 248, 141, 55, 3, 174, 8, 3, 32, 150,
		9, 206, 0, 3, 96, 177, 248, 141, 36, 3, 206, 0, 3, 96, 32, 108,
		9, 160, 49, 177, 232, 240, 30, 206, 12, 3, 240, 3, 76, 79, 9, 173,
		32, 3, 41, 15, 240, 11, 206, 32, 3, 177, 232, 141, 12, 3, 76, 79,
		9, 141, 44, 3, 96, 173, 28, 3, 24, 160, 50, 113, 232, 141, 28, 3,
		206, 16, 3, 208, 12, 238, 20, 3, 160, 51, 177, 232, 41, 127, 141, 16,
		3, 96, 173, 20, 3, 41, 3, 24, 105, 52, 168, 177, 232, 170, 160, 51,
		177, 232, 48, 14, 138, 109, 8, 3, 170, 173, 28, 3, 141, 55, 3, 76,
		150, 9, 138, 109, 28, 3, 141, 55, 3, 174, 8, 3, 189, 0, 4, 24,
		109, 55, 3, 141, 36, 3, 173, 40, 3, 41, 4, 208, 1, 96, 172, 0,
		3, 177, 240, 208, 21, 138, 24, 160, 0, 113, 248, 170, 189, 0, 4, 24,
		109, 55, 3, 24, 105, 255, 141, 38, 3, 96, 173, 36, 3, 24, 105, 255,
		141, 38, 3, 96, 172, 1, 3, 48, 70, 177, 234, 141, 33, 3, 177, 242,
		208, 9, 32, 93, 10, 206, 1, 3, 76, 64, 10, 201, 1, 240, 39, 201,
		3, 208, 16, 173, 9, 3, 24, 113, 250, 170, 173, 29, 3, 141, 55, 3,
		76, 9, 10, 173, 29, 3, 24, 113, 250, 141, 55, 3, 174, 9, 3, 32,
		135, 10, 206, 1, 3, 96, 177, 250, 141, 37, 3, 206, 1, 3, 96, 32,
		93, 10, 160, 49, 177, 234, 240, 30, 206, 13, 3, 240, 3, 76, 64, 10,
		173, 33, 3, 41, 15, 240, 11, 206, 33, 3, 177, 234, 141, 13, 3, 76,
		64, 10, 141, 45, 3, 96, 173, 29, 3, 24, 160, 50, 113, 234, 141, 29,
		3, 206, 17, 3, 208, 12, 238, 21, 3, 160, 51, 177, 234, 41, 127, 141,
		17, 3, 96, 173, 21, 3, 41, 3, 24, 105, 52, 168, 177, 234, 170, 160,
		51, 177, 234, 48, 14, 138, 109, 9, 3, 170, 173, 29, 3, 141, 55, 3,
		76, 135, 10, 138, 109, 29, 3, 141, 55, 3, 174, 9, 3, 189, 0, 4,
		24, 109, 55, 3, 141, 37, 3, 173, 41, 3, 41, 2, 208, 1, 96, 172,
		1, 3, 177, 242, 208, 21, 138, 24, 160, 0, 113, 250, 170, 189, 0, 4,
		24, 109, 55, 3, 24, 105, 255, 141, 39, 3, 96, 173, 37, 3, 24, 105,
		255, 141, 39, 3, 96, 172, 2, 3, 48, 70, 177, 236, 141, 34, 3, 177,
		244, 208, 9, 32, 78, 11, 206, 2, 3, 76, 49, 11, 201, 1, 240, 39,
		201, 3, 208, 16, 173, 10, 3, 24, 113, 252, 170, 173, 30, 3, 141, 55,
		3, 76, 250, 10, 173, 30, 3, 24, 113, 252, 141, 55, 3, 174, 10, 3,
		32, 120, 11, 206, 2, 3, 96, 177, 252, 141, 38, 3, 206, 2, 3, 96,
		32, 78, 11, 160, 49, 177, 236, 240, 30, 206, 14, 3, 240, 3, 76, 49,
		11, 173, 34, 3, 41, 15, 240, 11, 206, 34, 3, 177, 236, 141, 14, 3,
		76, 49, 11, 141, 46, 3, 96, 173, 30, 3, 24, 160, 50, 113, 236, 141,
		30, 3, 206, 18, 3, 208, 12, 238, 22, 3, 160, 51, 177, 236, 41, 127,
		141, 18, 3, 96, 173, 22, 3, 41, 3, 24, 105, 52, 168, 177, 236, 170,
		160, 51, 177, 236, 48, 14, 138, 109, 10, 3, 170, 173, 30, 3, 141, 55,
		3, 76, 120, 11, 138, 109, 30, 3, 141, 55, 3, 174, 10, 3, 189, 0,
		4, 24, 109, 55, 3, 141, 38, 3, 96, 172, 3, 3, 48, 70, 177, 238,
		141, 35, 3, 177, 246, 208, 9, 32, 18, 12, 206, 3, 3, 76, 245, 11,
		201, 1, 240, 39, 201, 3, 208, 16, 173, 11, 3, 24, 113, 254, 170, 173,
		31, 3, 141, 55, 3, 76, 190, 11, 173, 31, 3, 24, 113, 254, 141, 55,
		3, 174, 11, 3, 32, 60, 12, 206, 3, 3, 96, 177, 254, 141, 39, 3,
		206, 3, 3, 96, 32, 18, 12, 160, 49, 177, 238, 240, 30, 206, 15, 3,
		240, 3, 76, 245, 11, 173, 35, 3, 41, 15, 240, 11, 206, 35, 3, 177,
		238, 141, 15, 3, 76, 245, 11, 141, 47, 3, 96, 173, 31, 3, 24, 160,
		50, 113, 238, 141, 31, 3, 206, 19, 3, 208, 12, 238, 23, 3, 160, 51,
		177, 238, 41, 127, 141, 19, 3, 96, 173, 23, 3, 41, 3, 24, 105, 52,
		168, 177, 238, 170, 160, 51, 177, 238, 48, 14, 138, 109, 11, 3, 170, 173,
		31, 3, 141, 55, 3, 76, 60, 12, 138, 109, 31, 3, 141, 55, 3, 174,
		11, 3, 189, 0, 4, 24, 109, 55, 3, 141, 39, 3, 96 ]);
	static fc_obx = new Uint8Array([
		255, 255, 0, 4, 189, 8, 76, 9, 4, 32, 16, 4, 76, 173, 5, 162,
		0, 160, 10, 32, 25, 5, 162, 8, 189, 172, 8, 157, 0, 210, 157, 16,
		210, 202, 16, 244, 96, 133, 244, 162, 0, 134, 230, 134, 232, 134, 234, 169,
		0, 133, 231, 133, 233, 133, 235, 133, 236, 133, 238, 133, 240, 133, 237, 133,
		239, 133, 241, 138, 160, 2, 162, 4, 32, 9, 5, 136, 202, 202, 16, 248,
		162, 4, 32, 160, 4, 202, 202, 16, 249, 169, 255, 197, 230, 240, 34, 197,
		232, 240, 30, 197, 234, 240, 26, 169, 254, 160, 0, 209, 224, 240, 18, 209,
		226, 240, 14, 209, 228, 240, 10, 177, 224, 49, 226, 49, 228, 201, 255, 208,
		207, 162, 4, 32, 153, 4, 202, 202, 16, 249, 166, 230, 228, 232, 176, 2,
		166, 232, 228, 234, 176, 2, 166, 234, 232, 198, 244, 208, 140, 138, 96, 181,
		231, 240, 2, 246, 230, 96, 161, 224, 201, 254, 176, 29, 181, 230, 201, 255,
		240, 23, 181, 237, 208, 17, 161, 224, 201, 64, 144, 28, 208, 3, 32, 196,
		4, 32, 196, 4, 76, 160, 4, 214, 237, 96, 246, 224, 208, 2, 246, 225,
		180, 230, 200, 240, 2, 246, 230, 96, 168, 185, 191, 8, 133, 242, 185, 31,
		9, 133, 243, 180, 231, 246, 231, 177, 242, 201, 64, 144, 22, 201, 96, 144,
		23, 201, 255, 144, 238, 169, 0, 149, 237, 149, 236, 149, 231, 32, 196, 4,
		76, 160, 4, 181, 236, 149, 237, 96, 41, 31, 149, 236, 76, 221, 4, 72,
		24, 121, 159, 9, 149, 224, 169, 0, 121, 162, 9, 149, 225, 104, 96, 134,
		252, 132, 253, 72, 160, 2, 177, 252, 162, 0, 157, 127, 9, 24, 113, 252,
		232, 224, 32, 144, 245, 165, 252, 166, 253, 24, 105, 3, 144, 1, 232, 141,
		159, 9, 142, 162, 9, 232, 141, 160, 9, 142, 163, 9, 232, 141, 161, 9,
		142, 164, 9, 232, 133, 254, 134, 255, 24, 105, 128, 144, 1, 232, 133, 252,
		134, 253, 162, 0, 160, 0, 165, 252, 153, 191, 8, 165, 253, 153, 31, 9,
		161, 252, 230, 252, 208, 2, 230, 253, 201, 255, 208, 244, 200, 192, 64, 144,
		229, 162, 0, 165, 252, 157, 255, 8, 165, 253, 157, 95, 9, 160, 0, 177,
		252, 200, 201, 255, 208, 249, 152, 24, 101, 252, 133, 252, 144, 2, 230, 253,
		232, 224, 32, 144, 222, 104, 240, 3, 32, 31, 4, 141, 190, 8, 169, 64,
		141, 170, 8, 44, 170, 8, 48, 39, 80, 53, 169, 0, 162, 11, 157, 125,
		8, 202, 16, 250, 141, 170, 8, 162, 2, 169, 8, 157, 167, 8, 173, 190,
		8, 157, 122, 8, 202, 16, 242, 169, 80, 141, 180, 8, 76, 233, 5, 169,
		0, 162, 7, 157, 172, 8, 202, 16, 250, 169, 128, 141, 170, 8, 96, 238,
		171, 8, 162, 2, 134, 30, 232, 138, 10, 168, 132, 31, 202, 189, 159, 9,
		133, 28, 189, 162, 9, 133, 29, 189, 128, 8, 240, 3, 76, 240, 6, 188,
		122, 8, 177, 28, 201, 64, 240, 14, 201, 255, 240, 24, 201, 254, 208, 45,
		141, 170, 8, 76, 203, 7, 200, 177, 28, 141, 180, 8, 200, 152, 157, 122,
		8, 76, 9, 6, 173, 190, 8, 157, 122, 8, 169, 80, 141, 180, 8, 169,
		0, 157, 128, 8, 157, 131, 8, 157, 125, 8, 76, 9, 6, 72, 41, 128,
		240, 11, 254, 122, 8, 104, 41, 15, 157, 167, 8, 16, 178, 104, 168, 185,
		191, 8, 133, 28, 185, 31, 9, 133, 29, 189, 131, 8, 157, 128, 8, 169,
		0, 157, 158, 8, 188, 125, 8, 177, 28, 48, 7, 10, 48, 36, 74, 76,
		177, 6, 10, 10, 168, 177, 254, 157, 137, 8, 200, 177, 254, 157, 143, 8,
		200, 177, 254, 157, 146, 8, 200, 177, 254, 157, 149, 8, 254, 125, 8, 76,
		110, 6, 74, 41, 31, 170, 189, 127, 9, 166, 30, 157, 128, 8, 157, 131,
		8, 254, 125, 8, 76, 110, 6, 157, 155, 8, 24, 125, 167, 8, 168, 224,
		0, 208, 15, 185, 242, 7, 141, 172, 8, 185, 50, 8, 141, 174, 8, 76,
		215, 6, 185, 196, 7, 157, 134, 8, 164, 31, 153, 172, 8, 169, 0, 157,
		140, 8, 254, 125, 8, 188, 125, 8, 177, 28, 201, 255, 208, 8, 169, 0,
		157, 125, 8, 254, 122, 8, 189, 137, 8, 168, 185, 255, 8, 141, 6, 7,
		185, 95, 9, 141, 7, 7, 166, 30, 188, 140, 8, 185, 255, 255, 201, 255,
		240, 39, 16, 16, 164, 31, 153, 173, 8, 169, 0, 153, 172, 8, 254, 140,
		8, 76, 148, 7, 164, 31, 254, 140, 8, 29, 143, 8, 153, 173, 8, 224,
		0, 240, 6, 189, 134, 8, 153, 172, 8, 189, 146, 8, 240, 35, 173, 171,
		8, 41, 1, 208, 5, 189, 146, 8, 208, 2, 169, 0, 141, 78, 7, 24,
		189, 155, 8, 105, 2, 125, 167, 8, 168, 185, 196, 7, 164, 31, 153, 172,
		8, 189, 149, 8, 240, 52, 48, 32, 188, 152, 8, 254, 152, 8, 185, 181,
		8, 201, 31, 208, 7, 169, 0, 157, 152, 8, 240, 236, 24, 125, 134, 8,
		164, 31, 153, 172, 8, 76, 148, 7, 189, 134, 8, 201, 255, 240, 11, 254,
		134, 8, 254, 134, 8, 164, 31, 153, 172, 8, 189, 158, 8, 240, 41, 189,
		161, 8, 240, 6, 222, 161, 8, 76, 194, 7, 189, 158, 8, 16, 10, 24,
		189, 134, 8, 125, 164, 8, 76, 186, 7, 56, 189, 134, 8, 253, 164, 8,
		157, 134, 8, 164, 31, 153, 172, 8, 222, 128, 8, 202, 48, 3, 76, 238,
		5, 96, 255, 241, 228, 215, 203, 192, 181, 170, 161, 152, 143, 135, 127, 120,
		114, 107, 101, 95, 90, 85, 80, 75, 71, 67, 63, 60, 56, 53, 50, 47,
		44, 42, 39, 37, 35, 33, 31, 29, 28, 26, 23, 22, 19, 15, 7, 0,
		56, 140, 0, 106, 232, 106, 239, 128, 8, 174, 70, 230, 149, 65, 246, 176,
		110, 48, 246, 187, 132, 82, 34, 244, 200, 160, 122, 85, 52, 20, 245, 216,
		189, 164, 141, 119, 96, 78, 56, 39, 21, 6, 247, 232, 219, 207, 195, 184,
		172, 162, 154, 144, 136, 127, 120, 112, 106, 100, 94, 87, 82, 50, 10, 0,
		11, 10, 10, 9, 8, 8, 7, 7, 7, 6, 6, 5, 5, 5, 4, 4,
		4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1,
		1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 80, 0, 0, 1, 1, 0,
		0, 255, 255, 31 ]);
	static mpt_obx = new Uint8Array([
		255, 255, 0, 5, 178, 13, 76, 205, 11, 173, 46, 7, 208, 1, 96, 169,
		0, 141, 28, 14, 238, 29, 14, 173, 23, 14, 205, 187, 13, 144, 80, 206,
		21, 14, 240, 3, 76, 197, 5, 162, 0, 142, 23, 14, 169, 0, 157, 237,
		13, 157, 245, 13, 189, 179, 13, 133, 236, 189, 183, 13, 133, 237, 172, 22,
		14, 177, 236, 200, 201, 255, 240, 7, 201, 254, 208, 15, 76, 42, 12, 177,
		236, 48, 249, 10, 168, 140, 22, 14, 76, 59, 5, 157, 233, 13, 177, 236,
		157, 213, 13, 232, 224, 4, 208, 196, 200, 140, 22, 14, 76, 197, 5, 206,
		21, 14, 16, 87, 173, 188, 13, 141, 21, 14, 162, 3, 222, 245, 13, 16,
		68, 189, 233, 13, 10, 168, 185, 255, 255, 133, 236, 200, 185, 255, 255, 133,
		237, 5, 236, 240, 48, 189, 237, 13, 141, 31, 14, 32, 62, 7, 172, 31,
		14, 200, 152, 157, 237, 13, 189, 241, 13, 157, 245, 13, 224, 2, 208, 21,
		189, 197, 13, 73, 15, 10, 10, 10, 10, 105, 69, 141, 161, 13, 169, 10,
		105, 0, 141, 162, 13, 202, 16, 180, 238, 23, 14, 162, 1, 173, 27, 14,
		201, 2, 240, 2, 162, 3, 173, 27, 14, 201, 2, 208, 5, 236, 25, 14,
		240, 3, 76, 118, 6, 181, 240, 61, 114, 6, 240, 18, 160, 40, 177, 236,
		24, 125, 225, 13, 32, 117, 9, 56, 125, 1, 14, 157, 203, 13, 202, 16,
		213, 169, 3, 141, 15, 210, 165, 241, 41, 16, 240, 15, 172, 226, 13, 185,
		198, 9, 141, 201, 13, 185, 5, 10, 141, 202, 13, 173, 201, 13, 141, 0,
		210, 173, 202, 13, 141, 2, 210, 173, 203, 13, 141, 4, 210, 173, 204, 13,
		141, 6, 210, 173, 193, 13, 162, 255, 172, 27, 14, 192, 1, 208, 5, 174,
		25, 14, 240, 3, 141, 1, 210, 173, 194, 13, 224, 1, 240, 3, 141, 3,
		210, 192, 2, 240, 20, 173, 195, 13, 224, 2, 240, 3, 141, 5, 210, 173,
		196, 13, 224, 3, 240, 3, 141, 7, 210, 165, 240, 5, 241, 5, 242, 5,
		243, 13, 28, 14, 141, 8, 210, 96, 4, 2, 0, 0, 189, 217, 13, 133,
		236, 189, 221, 13, 133, 237, 5, 236, 208, 8, 157, 193, 13, 149, 240, 76,
		248, 5, 180, 244, 192, 32, 240, 66, 177, 236, 56, 253, 197, 13, 44, 58,
		7, 240, 2, 41, 240, 157, 193, 13, 200, 177, 236, 141, 30, 14, 200, 148,
		244, 41, 7, 240, 60, 168, 185, 126, 9, 141, 203, 6, 185, 133, 9, 141,
		204, 6, 173, 30, 14, 74, 74, 74, 74, 74, 9, 40, 168, 177, 236, 24,
		32, 255, 255, 169, 0, 149, 240, 76, 248, 5, 189, 9, 14, 240, 18, 222,
		13, 14, 208, 13, 157, 13, 14, 189, 193, 13, 41, 15, 240, 3, 222, 193,
		13, 160, 35, 177, 236, 149, 240, 189, 17, 14, 24, 105, 37, 168, 41, 3,
		157, 17, 14, 136, 177, 236, 125, 209, 13, 157, 225, 13, 32, 119, 9, 157,
		201, 13, 189, 5, 14, 240, 6, 222, 5, 14, 76, 223, 5, 189, 189, 13,
		141, 30, 7, 16, 254, 76, 194, 8, 0, 76, 229, 8, 0, 76, 251, 8,
		0, 76, 21, 9, 0, 76, 37, 9, 0, 76, 56, 9, 0, 76, 66, 9,
		16, 76, 72, 9, 169, 0, 157, 197, 13, 172, 31, 14, 136, 200, 177, 236,
		201, 254, 208, 4, 140, 31, 14, 96, 201, 224, 144, 8, 173, 187, 13, 141,
		23, 14, 208, 233, 201, 208, 144, 10, 41, 15, 141, 188, 13, 141, 21, 14,
		16, 219, 201, 192, 144, 9, 41, 15, 73, 15, 157, 197, 13, 16, 206, 201,
		128, 144, 7, 41, 63, 157, 241, 13, 16, 195, 201, 64, 144, 27, 200, 140,
		31, 14, 41, 31, 157, 229, 13, 10, 168, 185, 255, 255, 157, 217, 13, 200,
		185, 255, 255, 157, 221, 13, 76, 62, 7, 140, 31, 14, 141, 30, 14, 24,
		125, 213, 13, 157, 209, 13, 173, 27, 14, 240, 66, 201, 2, 240, 58, 189,
		229, 13, 201, 31, 208, 55, 173, 30, 14, 56, 233, 1, 41, 15, 168, 177,
		254, 133, 253, 152, 9, 16, 168, 177, 254, 133, 248, 160, 1, 5, 253, 208,
		2, 160, 0, 140, 26, 14, 169, 0, 133, 252, 157, 217, 13, 157, 221, 13,
		138, 10, 141, 24, 14, 142, 25, 14, 96, 224, 2, 176, 99, 189, 217, 13,
		133, 238, 189, 221, 13, 133, 239, 5, 238, 240, 74, 160, 32, 177, 238, 41,
		15, 157, 249, 13, 177, 238, 41, 112, 74, 74, 157, 189, 13, 200, 177, 238,
		10, 10, 72, 41, 63, 157, 5, 14, 104, 41, 192, 157, 205, 13, 200, 177,
		238, 157, 9, 14, 157, 13, 14, 169, 0, 149, 244, 157, 17, 14, 157, 253,
		13, 157, 1, 14, 189, 209, 13, 157, 225, 13, 32, 117, 9, 157, 201, 13,
		236, 25, 14, 240, 1, 96, 160, 255, 140, 25, 14, 200, 140, 26, 14, 96,
		224, 2, 208, 51, 172, 211, 13, 185, 69, 11, 141, 121, 13, 185, 129, 11,
		141, 127, 13, 169, 0, 133, 249, 133, 250, 173, 231, 13, 41, 15, 168, 177,
		254, 133, 251, 152, 9, 16, 168, 177, 254, 141, 137, 13, 5, 251, 208, 6,
		141, 121, 13, 141, 127, 13, 96, 173, 232, 13, 41, 15, 168, 177, 254, 133,
		253, 152, 9, 16, 168, 177, 254, 5, 253, 240, 15, 177, 254, 56, 229, 253,
		133, 248, 169, 0, 133, 252, 169, 141, 208, 2, 169, 173, 141, 97, 13, 141,
		56, 13, 169, 24, 141, 7, 210, 96, 173, 29, 14, 41, 7, 74, 74, 144,
		18, 208, 24, 189, 249, 13, 24, 157, 1, 14, 125, 201, 13, 157, 201, 13,
		76, 223, 5, 169, 0, 157, 1, 14, 76, 223, 5, 189, 201, 13, 56, 253,
		249, 13, 157, 201, 13, 56, 169, 0, 253, 249, 13, 157, 1, 14, 76, 223,
		5, 189, 253, 13, 24, 157, 1, 14, 125, 201, 13, 157, 201, 13, 24, 189,
		253, 13, 125, 249, 13, 157, 253, 13, 76, 223, 5, 189, 225, 13, 56, 253,
		253, 13, 157, 225, 13, 32, 117, 9, 76, 5, 9, 169, 0, 56, 253, 253,
		13, 157, 1, 14, 189, 201, 13, 56, 253, 253, 13, 76, 5, 9, 189, 225,
		13, 24, 125, 253, 13, 76, 28, 9, 32, 85, 9, 76, 208, 8, 32, 85,
		9, 24, 125, 225, 13, 32, 155, 9, 76, 223, 5, 188, 253, 13, 189, 249,
		13, 48, 2, 200, 200, 136, 152, 157, 253, 13, 221, 249, 13, 208, 8, 189,
		249, 13, 73, 255, 157, 249, 13, 189, 253, 13, 96, 41, 63, 29, 205, 13,
		168, 185, 255, 255, 96, 148, 145, 152, 165, 173, 180, 192, 9, 9, 9, 9,
		9, 9, 9, 64, 0, 32, 0, 125, 201, 13, 157, 201, 13, 96, 125, 209,
		13, 157, 225, 13, 32, 117, 9, 157, 201, 13, 96, 157, 201, 13, 189, 141,
		9, 16, 12, 157, 201, 13, 169, 128, 208, 5, 157, 201, 13, 169, 1, 13,
		28, 14, 141, 28, 14, 96, 45, 10, 210, 157, 201, 13, 96, 242, 51, 150,
		226, 56, 140, 0, 106, 232, 106, 239, 128, 8, 174, 70, 230, 149, 65, 246,
		176, 110, 48, 246, 187, 132, 82, 34, 244, 200, 160, 122, 85, 52, 20, 245,
		216, 189, 164, 141, 119, 96, 78, 56, 39, 21, 6, 247, 232, 219, 207, 195,
		184, 172, 162, 154, 144, 136, 127, 120, 112, 106, 100, 94, 13, 13, 12, 11,
		11, 10, 10, 9, 8, 8, 7, 7, 7, 6, 6, 5, 5, 5, 4, 4,
		4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1,
		1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 22, 22, 23, 23, 23,
		23, 24, 24, 24, 24, 24, 25, 25, 25, 25, 26, 21, 21, 22, 22, 22,
		23, 23, 24, 24, 24, 25, 25, 26, 26, 26, 27, 20, 21, 21, 22, 22,
		23, 23, 24, 24, 24, 25, 25, 26, 26, 27, 27, 20, 20, 21, 21, 22,
		22, 23, 23, 24, 25, 25, 26, 26, 27, 27, 28, 19, 20, 20, 21, 22,
		22, 23, 23, 24, 25, 25, 26, 26, 27, 28, 28, 19, 19, 20, 21, 21,
		22, 23, 23, 24, 25, 25, 26, 27, 27, 28, 29, 18, 19, 20, 20, 21,
		22, 23, 23, 24, 25, 25, 26, 27, 28, 28, 29, 18, 19, 19, 20, 21,
		22, 22, 23, 24, 25, 26, 26, 27, 28, 29, 29, 18, 18, 19, 20, 21,
		22, 22, 23, 24, 25, 26, 26, 27, 28, 29, 30, 17, 18, 19, 20, 21,
		22, 22, 23, 24, 25, 26, 26, 27, 28, 29, 30, 17, 18, 19, 20, 21,
		21, 22, 23, 24, 25, 26, 27, 27, 28, 29, 30, 17, 18, 19, 20, 20,
		21, 22, 23, 24, 25, 26, 27, 28, 28, 29, 30, 17, 18, 19, 19, 20,
		21, 22, 23, 24, 25, 26, 27, 28, 29, 29, 30, 17, 18, 18, 19, 20,
		21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 30, 16, 17, 18, 19, 20,
		21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 36, 38, 41,
		43, 46, 48, 51, 55, 58, 61, 65, 69, 73, 77, 82, 87, 92, 97, 103,
		110, 116, 123, 130, 138, 146, 155, 164, 174, 184, 195, 207, 220, 233, 246, 5,
		21, 37, 55, 73, 93, 113, 135, 159, 184, 210, 237, 11, 42, 75, 110, 147,
		186, 227, 15, 62, 112, 164, 219, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1,
		1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3,
		3, 3, 3, 229, 42, 64, 89, 100, 238, 8, 166, 11, 12, 12, 12, 12,
		12, 13, 13, 142, 50, 7, 140, 54, 7, 41, 7, 168, 185, 189, 11, 141,
		227, 11, 185, 197, 11, 141, 228, 11, 76, 255, 255, 173, 54, 7, 174, 50,
		7, 141, 148, 7, 141, 155, 7, 142, 149, 7, 142, 156, 7, 24, 105, 64,
		141, 129, 5, 141, 135, 5, 144, 1, 232, 142, 130, 5, 142, 136, 5, 24,
		105, 128, 141, 124, 9, 144, 1, 232, 142, 125, 9, 232, 141, 31, 12, 142,
		32, 12, 162, 9, 189, 255, 255, 157, 179, 13, 202, 16, 247, 206, 188, 13,
		169, 0, 141, 46, 7, 162, 98, 157, 189, 13, 202, 16, 250, 162, 8, 157,
		0, 210, 202, 16, 250, 96, 32, 42, 12, 173, 50, 7, 10, 141, 22, 14,
		173, 187, 13, 141, 23, 14, 169, 1, 141, 21, 14, 141, 46, 7, 96, 173,
		54, 7, 133, 254, 173, 50, 7, 133, 255, 96, 173, 54, 7, 41, 3, 170,
		173, 50, 7, 32, 198, 7, 173, 26, 14, 240, 238, 14, 54, 7, 32, 190,
		12, 169, 1, 141, 27, 14, 173, 26, 14, 240, 222, 201, 1, 208, 5, 160,
		0, 238, 26, 14, 177, 252, 174, 24, 14, 74, 74, 74, 74, 9, 16, 141,
		10, 212, 141, 10, 212, 157, 1, 210, 177, 252, 9, 16, 141, 10, 212, 141,
		10, 212, 157, 1, 210, 200, 208, 206, 230, 253, 165, 253, 197, 248, 208, 198,
		140, 26, 14, 96, 144, 21, 169, 234, 141, 153, 12, 141, 154, 12, 141, 155,
		12, 141, 166, 12, 141, 167, 12, 141, 168, 12, 96, 169, 141, 141, 153, 12,
		141, 166, 12, 169, 10, 141, 154, 12, 141, 167, 12, 169, 212, 141, 155, 12,
		141, 168, 12, 96, 169, 0, 141, 26, 14, 173, 50, 7, 74, 32, 190, 12,
		169, 1, 141, 27, 14, 32, 128, 12, 173, 27, 14, 208, 248, 96, 169, 2,
		141, 27, 14, 141, 25, 14, 169, 24, 141, 7, 210, 169, 17, 133, 250, 169,
		13, 133, 251, 169, 173, 141, 97, 13, 141, 56, 13, 160, 0, 140, 121, 13,
		140, 127, 13, 174, 11, 212, 177, 252, 74, 74, 74, 74, 9, 16, 141, 7,
		210, 32, 117, 13, 236, 11, 212, 240, 251, 141, 5, 210, 174, 11, 212, 177,
		252, 230, 252, 208, 16, 230, 253, 198, 248, 208, 10, 169, 173, 141, 97, 13,
		141, 56, 13, 169, 8, 9, 16, 141, 7, 210, 32, 117, 13, 236, 11, 212,
		240, 251, 141, 5, 210, 173, 27, 14, 208, 185, 96, 24, 165, 249, 105, 0,
		133, 249, 165, 250, 105, 0, 133, 250, 144, 15, 230, 251, 165, 251, 201, 0,
		208, 7, 140, 121, 13, 140, 127, 13, 96, 177, 250, 36, 249, 48, 4, 74,
		74, 74, 74, 41, 15, 168, 185, 69, 10, 160, 0, 96, 160, 0, 140, 27,
		14, 140, 26, 14, 136, 140, 25, 14, 96 ]);
	static rmt4_obx = new Uint8Array([
		255, 255, 144, 3, 96, 11, 128, 0, 128, 32, 128, 64, 0, 192, 128, 128,
		128, 160, 0, 192, 64, 192, 0, 1, 5, 11, 21, 0, 1, 255, 255, 1,
		1, 0, 255, 255, 0, 1, 1, 1, 0, 255, 255, 255, 255, 0, 1, 1,
		0, 0, 0, 0, 0, 0, 242, 51, 150, 226, 56, 140, 0, 106, 232, 106,
		239, 128, 8, 174, 70, 230, 149, 65, 246, 176, 110, 48, 246, 187, 132, 82,
		34, 244, 200, 160, 122, 85, 52, 20, 245, 216, 189, 164, 141, 119, 96, 78,
		56, 39, 21, 6, 247, 232, 219, 207, 195, 184, 172, 162, 154, 144, 136, 127,
		120, 112, 106, 100, 94, 0, 191, 182, 170, 161, 152, 143, 137, 128, 242, 230,
		218, 206, 191, 182, 170, 161, 152, 143, 137, 128, 122, 113, 107, 101, 95, 92,
		86, 80, 77, 71, 68, 62, 60, 56, 53, 50, 47, 45, 42, 40, 37, 35,
		33, 31, 29, 28, 26, 24, 23, 22, 20, 19, 18, 17, 16, 15, 14, 13,
		12, 11, 10, 9, 8, 7, 255, 241, 228, 216, 202, 192, 181, 171, 162, 153,
		142, 135, 127, 121, 115, 112, 102, 97, 90, 85, 82, 75, 72, 67, 63, 60,
		57, 55, 51, 48, 45, 42, 40, 37, 36, 33, 31, 30, 28, 27, 25, 23,
		22, 21, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
		5, 4, 3, 2, 1, 0, 243, 230, 217, 204, 193, 181, 173, 162, 153, 144,
		136, 128, 121, 114, 108, 102, 96, 91, 85, 81, 76, 72, 68, 64, 60, 57,
		53, 50, 47, 45, 42, 40, 37, 35, 33, 31, 29, 28, 26, 24, 23, 22,
		20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5,
		4, 3, 2, 1, 0, 0, 13, 13, 12, 11, 11, 10, 10, 9, 8, 8,
		7, 7, 7, 6, 6, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3,
		3, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1,
		1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
		1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
		1, 1, 2, 2, 2, 2, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2,
		2, 2, 2, 3, 3, 3, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
		3, 3, 3, 3, 4, 4, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3,
		3, 4, 4, 4, 5, 5, 0, 0, 1, 1, 2, 2, 2, 3, 3, 4,
		4, 4, 5, 5, 6, 6, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4,
		5, 5, 6, 6, 7, 7, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5,
		5, 6, 6, 7, 7, 8, 0, 1, 1, 2, 2, 3, 4, 4, 5, 5,
		6, 7, 7, 8, 8, 9, 0, 1, 1, 2, 3, 3, 4, 5, 5, 6,
		7, 7, 8, 9, 9, 10, 0, 1, 1, 2, 3, 4, 4, 5, 6, 7,
		7, 8, 9, 10, 10, 11, 0, 1, 2, 2, 3, 4, 5, 6, 6, 7,
		8, 9, 10, 10, 11, 12, 0, 1, 2, 3, 3, 4, 5, 6, 7, 8,
		9, 10, 10, 11, 12, 13, 0, 1, 2, 3, 4, 5, 6, 7, 7, 8,
		9, 10, 11, 12, 13, 14, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
		10, 11, 12, 13, 14, 15, 76, 15, 6, 76, 252, 7, 76, 33, 8, 76,
		88, 6, 76, 43, 11, 134, 211, 132, 212, 72, 160, 168, 169, 0, 153, 127,
		2, 136, 208, 250, 160, 4, 177, 211, 141, 21, 8, 200, 177, 211, 141, 36,
		3, 200, 177, 211, 141, 5, 8, 141, 38, 3, 160, 8, 177, 211, 153, 195,
		0, 200, 192, 16, 208, 246, 104, 72, 10, 10, 24, 101, 209, 133, 209, 104,
		8, 41, 192, 10, 42, 42, 40, 101, 210, 133, 210, 32, 110, 6, 169, 0,
		141, 8, 210, 160, 3, 140, 15, 210, 160, 8, 153, 0, 210, 136, 16, 250,
		173, 5, 8, 96, 162, 0, 142, 39, 3, 138, 168, 177, 209, 201, 254, 176,
		45, 168, 177, 205, 157, 128, 2, 177, 207, 157, 132, 2, 169, 0, 157, 136,
		2, 169, 1, 157, 140, 2, 169, 128, 157, 180, 2, 232, 224, 4, 208, 217,
		165, 209, 24, 105, 4, 133, 209, 144, 27, 230, 210, 76, 190, 6, 240, 4,
		169, 0, 240, 223, 160, 2, 177, 209, 170, 200, 177, 209, 133, 210, 134, 209,
		162, 0, 240, 181, 173, 36, 3, 141, 22, 7, 162, 255, 232, 222, 140, 2,
		208, 69, 189, 128, 2, 133, 211, 189, 132, 2, 133, 212, 188, 136, 2, 254,
		136, 2, 177, 211, 133, 217, 41, 63, 201, 61, 240, 17, 176, 56, 157, 144,
		2, 157, 16, 3, 200, 177, 211, 74, 41, 126, 157, 180, 2, 169, 1, 157,
		140, 2, 188, 136, 2, 254, 136, 2, 177, 211, 74, 102, 217, 74, 102, 217,
		165, 217, 41, 240, 157, 148, 2, 224, 3, 208, 177, 169, 255, 141, 36, 3,
		141, 37, 3, 76, 101, 7, 201, 63, 240, 27, 165, 217, 41, 192, 240, 9,
		10, 42, 42, 157, 140, 2, 76, 17, 7, 200, 177, 211, 157, 140, 2, 254,
		136, 2, 76, 17, 7, 165, 217, 48, 12, 200, 177, 211, 141, 22, 7, 254,
		136, 2, 76, 214, 6, 201, 255, 240, 9, 200, 177, 211, 157, 136, 2, 76,
		214, 6, 76, 110, 6, 76, 33, 8, 202, 48, 250, 188, 180, 2, 48, 248,
		177, 203, 157, 184, 2, 133, 215, 200, 177, 203, 157, 188, 2, 133, 216, 169,
		1, 157, 20, 3, 168, 177, 215, 157, 4, 3, 200, 177, 215, 157, 196, 2,
		200, 177, 215, 157, 200, 2, 200, 177, 215, 157, 240, 2, 41, 63, 157, 8,
		3, 177, 215, 41, 64, 157, 244, 2, 200, 177, 215, 157, 32, 3, 200, 177,
		215, 157, 208, 2, 200, 177, 215, 157, 216, 2, 200, 177, 215, 157, 220, 2,
		200, 177, 215, 168, 185, 160, 3, 157, 224, 2, 157, 228, 2, 185, 161, 3,
		157, 232, 2, 160, 10, 177, 215, 157, 236, 2, 169, 128, 157, 212, 2, 157,
		180, 2, 10, 157, 204, 2, 157, 156, 2, 168, 177, 215, 157, 0, 3, 105,
		0, 157, 192, 2, 169, 12, 157, 252, 2, 168, 177, 215, 157, 248, 2, 76,
		98, 7, 32, 43, 11, 206, 38, 3, 208, 29, 169, 255, 141, 38, 3, 206,
		37, 3, 208, 19, 238, 39, 3, 173, 39, 3, 201, 255, 240, 3, 76, 190,
		6, 76, 110, 6, 76, 95, 10, 169, 4, 133, 214, 162, 3, 189, 188, 2,
		240, 242, 133, 212, 189, 184, 2, 133, 211, 188, 192, 2, 177, 211, 133, 217,
		200, 177, 211, 133, 218, 200, 177, 211, 133, 219, 200, 152, 221, 196, 2, 144,
		10, 240, 8, 169, 128, 157, 204, 2, 189, 200, 2, 157, 192, 2, 165, 217,
		41, 15, 29, 148, 2, 168, 185, 0, 5, 133, 220, 165, 218, 41, 14, 168,
		185, 144, 3, 133, 213, 165, 220, 25, 145, 3, 157, 28, 3, 189, 220, 2,
		240, 40, 201, 1, 208, 33, 189, 156, 2, 24, 125, 236, 2, 24, 188, 224,
		2, 121, 165, 3, 157, 156, 2, 200, 152, 221, 232, 2, 208, 3, 189, 228,
		2, 157, 224, 2, 76, 164, 8, 222, 220, 2, 188, 0, 3, 192, 13, 144,
		60, 189, 8, 3, 16, 49, 152, 221, 252, 2, 208, 8, 189, 4, 3, 157,
		252, 2, 208, 3, 254, 252, 2, 189, 184, 2, 133, 215, 189, 188, 2, 133,
		216, 188, 252, 2, 177, 215, 188, 244, 2, 240, 4, 24, 125, 248, 2, 157,
		248, 2, 189, 240, 2, 41, 63, 56, 233, 1, 157, 8, 3, 189, 204, 2,
		16, 31, 189, 148, 2, 240, 26, 221, 216, 2, 240, 21, 144, 19, 168, 189,
		212, 2, 24, 125, 208, 2, 157, 212, 2, 144, 6, 152, 233, 16, 157, 148,
		2, 169, 0, 133, 221, 165, 218, 157, 12, 3, 41, 112, 74, 74, 141, 28,
		9, 144, 254, 76, 210, 9, 234, 76, 60, 9, 234, 76, 65, 9, 234, 76,
		75, 9, 234, 76, 87, 9, 234, 76, 102, 9, 234, 76, 169, 9, 234, 76,
		184, 9, 165, 219, 76, 21, 10, 165, 219, 133, 221, 189, 144, 2, 76, 216,
		9, 189, 144, 2, 24, 101, 219, 157, 144, 2, 76, 216, 9, 189, 156, 2,
		24, 101, 219, 157, 156, 2, 189, 144, 2, 76, 216, 9, 189, 240, 2, 16,
		12, 188, 144, 2, 177, 213, 24, 125, 248, 2, 76, 135, 9, 189, 144, 2,
		24, 125, 248, 2, 201, 61, 144, 2, 169, 63, 168, 177, 213, 157, 160, 2,
		164, 219, 208, 3, 157, 164, 2, 152, 74, 74, 74, 74, 157, 168, 2, 157,
		172, 2, 165, 219, 41, 15, 157, 176, 2, 189, 144, 2, 76, 216, 9, 165,
		219, 24, 125, 20, 3, 157, 20, 3, 189, 144, 2, 76, 216, 9, 165, 219,
		201, 128, 240, 6, 157, 144, 2, 76, 216, 9, 189, 28, 3, 9, 240, 157,
		28, 3, 189, 144, 2, 76, 216, 9, 189, 144, 2, 24, 101, 219, 188, 240,
		2, 48, 31, 24, 125, 248, 2, 201, 61, 144, 7, 169, 0, 157, 28, 3,
		169, 63, 157, 16, 3, 168, 177, 213, 24, 125, 156, 2, 24, 101, 221, 76,
		21, 10, 201, 61, 144, 7, 169, 0, 157, 28, 3, 169, 63, 168, 189, 156,
		2, 24, 125, 248, 2, 24, 113, 213, 24, 101, 221, 157, 24, 3, 189, 172,
		2, 240, 50, 222, 172, 2, 208, 45, 189, 168, 2, 157, 172, 2, 189, 164,
		2, 221, 160, 2, 240, 31, 176, 13, 125, 176, 2, 176, 18, 221, 160, 2,
		176, 13, 76, 76, 10, 253, 176, 2, 144, 5, 221, 160, 2, 176, 3, 189,
		160, 2, 157, 164, 2, 165, 218, 41, 1, 240, 10, 189, 164, 2, 24, 125,
		156, 2, 157, 24, 3, 202, 48, 3, 76, 39, 8, 173, 32, 3, 13, 33,
		3, 13, 34, 3, 13, 35, 3, 170, 142, 44, 11, 173, 12, 3, 16, 33,
		173, 28, 3, 41, 15, 240, 26, 173, 24, 3, 24, 109, 20, 3, 141, 26,
		3, 173, 30, 3, 41, 16, 208, 5, 169, 0, 141, 30, 3, 138, 9, 4,
		170, 173, 13, 3, 16, 33, 173, 29, 3, 41, 15, 240, 26, 173, 25, 3,
		24, 109, 21, 3, 141, 27, 3, 173, 31, 3, 41, 16, 208, 5, 169, 0,
		141, 31, 3, 138, 9, 2, 170, 236, 44, 11, 208, 94, 173, 13, 3, 41,
		14, 201, 6, 208, 38, 173, 29, 3, 41, 15, 240, 31, 172, 17, 3, 185,
		192, 3, 141, 24, 3, 185, 192, 4, 141, 25, 3, 173, 28, 3, 41, 16,
		208, 5, 169, 0, 141, 28, 3, 138, 9, 80, 170, 173, 15, 3, 41, 14,
		201, 6, 208, 38, 173, 31, 3, 41, 15, 240, 31, 172, 19, 3, 185, 192,
		3, 141, 26, 3, 185, 192, 4, 141, 27, 3, 173, 30, 3, 41, 16, 208,
		5, 169, 0, 141, 30, 3, 138, 9, 40, 170, 142, 44, 11, 173, 38, 3,
		96, 160, 255, 173, 24, 3, 174, 28, 3, 141, 0, 210, 142, 1, 210, 173,
		25, 3, 174, 29, 3, 141, 2, 210, 142, 3, 210, 173, 26, 3, 174, 30,
		3, 141, 4, 210, 142, 5, 210, 173, 27, 3, 174, 31, 3, 141, 6, 210,
		142, 7, 210, 140, 8, 210, 96 ]);
	static rmt8_obx = new Uint8Array([
		255, 255, 144, 3, 108, 12, 128, 0, 128, 32, 128, 64, 0, 192, 128, 128,
		128, 160, 0, 192, 64, 192, 0, 1, 5, 11, 21, 0, 1, 255, 255, 1,
		1, 0, 255, 255, 0, 1, 1, 1, 0, 255, 255, 255, 255, 0, 1, 1,
		0, 0, 0, 0, 0, 0, 242, 51, 150, 226, 56, 140, 0, 106, 232, 106,
		239, 128, 8, 174, 70, 230, 149, 65, 246, 176, 110, 48, 246, 187, 132, 82,
		34, 244, 200, 160, 122, 85, 52, 20, 245, 216, 189, 164, 141, 119, 96, 78,
		56, 39, 21, 6, 247, 232, 219, 207, 195, 184, 172, 162, 154, 144, 136, 127,
		120, 112, 106, 100, 94, 0, 191, 182, 170, 161, 152, 143, 137, 128, 242, 230,
		218, 206, 191, 182, 170, 161, 152, 143, 137, 128, 122, 113, 107, 101, 95, 92,
		86, 80, 77, 71, 68, 62, 60, 56, 53, 50, 47, 45, 42, 40, 37, 35,
		33, 31, 29, 28, 26, 24, 23, 22, 20, 19, 18, 17, 16, 15, 14, 13,
		12, 11, 10, 9, 8, 7, 255, 241, 228, 216, 202, 192, 181, 171, 162, 153,
		142, 135, 127, 121, 115, 112, 102, 97, 90, 85, 82, 75, 72, 67, 63, 60,
		57, 55, 51, 48, 45, 42, 40, 37, 36, 33, 31, 30, 28, 27, 25, 23,
		22, 21, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
		5, 4, 3, 2, 1, 0, 243, 230, 217, 204, 193, 181, 173, 162, 153, 144,
		136, 128, 121, 114, 108, 102, 96, 91, 85, 81, 76, 72, 68, 64, 60, 57,
		53, 50, 47, 45, 42, 40, 37, 35, 33, 31, 29, 28, 26, 24, 23, 22,
		20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5,
		4, 3, 2, 1, 0, 0, 13, 13, 12, 11, 11, 10, 10, 9, 8, 8,
		7, 7, 7, 6, 6, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3,
		3, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1,
		1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
		1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
		1, 1, 2, 2, 2, 2, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2,
		2, 2, 2, 3, 3, 3, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
		3, 3, 3, 3, 4, 4, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3,
		3, 4, 4, 4, 5, 5, 0, 0, 1, 1, 2, 2, 2, 3, 3, 4,
		4, 4, 5, 5, 6, 6, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4,
		5, 5, 6, 6, 7, 7, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5,
		5, 6, 6, 7, 7, 8, 0, 1, 1, 2, 2, 3, 4, 4, 5, 5,
		6, 7, 7, 8, 8, 9, 0, 1, 1, 2, 3, 3, 4, 5, 5, 6,
		7, 7, 8, 9, 9, 10, 0, 1, 1, 2, 3, 4, 4, 5, 6, 7,
		7, 8, 9, 10, 10, 11, 0, 1, 2, 2, 3, 4, 5, 6, 6, 7,
		8, 9, 10, 10, 11, 12, 0, 1, 2, 3, 3, 4, 5, 6, 7, 8,
		9, 10, 10, 11, 12, 13, 0, 1, 2, 3, 4, 5, 6, 7, 7, 8,
		9, 10, 11, 12, 13, 14, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
		10, 11, 12, 13, 14, 15, 76, 15, 6, 76, 9, 8, 76, 46, 8, 76,
		92, 6, 76, 2, 12, 134, 211, 132, 212, 72, 160, 0, 152, 153, 0, 2,
		153, 76, 2, 200, 208, 247, 160, 4, 177, 211, 141, 34, 8, 200, 177, 211,
		141, 72, 3, 200, 177, 211, 141, 18, 8, 141, 74, 3, 160, 8, 177, 211,
		153, 195, 0, 200, 192, 16, 208, 246, 104, 72, 10, 10, 10, 24, 101, 209,
		133, 209, 104, 8, 41, 224, 10, 42, 42, 42, 40, 101, 210, 133, 210, 32,
		123, 6, 169, 0, 141, 8, 210, 141, 24, 210, 160, 3, 140, 15, 210, 140,
		31, 210, 160, 8, 153, 0, 210, 153, 16, 210, 136, 16, 247, 173, 18, 8,
		96, 162, 0, 142, 75, 3, 138, 168, 177, 209, 201, 254, 176, 45, 168, 177,
		205, 157, 0, 2, 177, 207, 157, 8, 2, 169, 0, 157, 16, 2, 169, 1,
		157, 24, 2, 169, 128, 157, 104, 2, 232, 224, 8, 208, 217, 165, 209, 24,
		105, 8, 133, 209, 144, 27, 230, 210, 76, 203, 6, 240, 4, 169, 0, 240,
		223, 160, 2, 177, 209, 170, 200, 177, 209, 133, 210, 134, 209, 162, 0, 240,
		181, 173, 72, 3, 141, 35, 7, 162, 255, 232, 222, 24, 2, 208, 69, 189,
		0, 2, 133, 211, 189, 8, 2, 133, 212, 188, 16, 2, 254, 16, 2, 177,
		211, 133, 217, 41, 63, 201, 61, 240, 17, 176, 56, 157, 32, 2, 157, 32,
		3, 200, 177, 211, 74, 41, 126, 157, 104, 2, 169, 1, 157, 24, 2, 188,
		16, 2, 254, 16, 2, 177, 211, 74, 102, 217, 74, 102, 217, 165, 217, 41,
		240, 157, 40, 2, 224, 7, 208, 177, 169, 255, 141, 72, 3, 141, 73, 3,
		76, 114, 7, 201, 63, 240, 27, 165, 217, 41, 192, 240, 9, 10, 42, 42,
		157, 24, 2, 76, 30, 7, 200, 177, 211, 157, 24, 2, 254, 16, 2, 76,
		30, 7, 165, 217, 48, 12, 200, 177, 211, 141, 35, 7, 254, 16, 2, 76,
		227, 6, 201, 255, 240, 9, 200, 177, 211, 157, 16, 2, 76, 227, 6, 76,
		123, 6, 76, 46, 8, 202, 48, 250, 188, 104, 2, 48, 248, 177, 203, 157,
		112, 2, 133, 215, 200, 177, 203, 157, 120, 2, 133, 216, 169, 1, 157, 40,
		3, 168, 177, 215, 157, 8, 3, 200, 177, 215, 157, 136, 2, 200, 177, 215,
		157, 144, 2, 200, 177, 215, 157, 224, 2, 41, 63, 157, 16, 3, 177, 215,
		41, 64, 157, 232, 2, 200, 177, 215, 157, 64, 3, 200, 177, 215, 157, 160,
		2, 200, 177, 215, 157, 176, 2, 200, 177, 215, 157, 184, 2, 200, 177, 215,
		168, 185, 160, 3, 157, 192, 2, 157, 200, 2, 185, 161, 3, 157, 208, 2,
		160, 10, 177, 215, 157, 216, 2, 169, 128, 157, 168, 2, 157, 104, 2, 10,
		157, 152, 2, 157, 56, 2, 168, 177, 215, 157, 0, 3, 105, 0, 157, 128,
		2, 169, 12, 157, 248, 2, 168, 177, 215, 157, 240, 2, 76, 111, 7, 32,
		2, 12, 206, 74, 3, 208, 29, 169, 255, 141, 74, 3, 206, 73, 3, 208,
		19, 238, 75, 3, 173, 75, 3, 201, 255, 240, 3, 76, 203, 6, 76, 123,
		6, 76, 116, 10, 169, 4, 133, 214, 162, 7, 189, 120, 2, 240, 242, 133,
		212, 189, 112, 2, 133, 211, 188, 128, 2, 177, 211, 133, 217, 200, 177, 211,
		133, 218, 200, 177, 211, 133, 219, 200, 152, 221, 136, 2, 144, 10, 240, 8,
		169, 128, 157, 152, 2, 189, 144, 2, 157, 128, 2, 165, 217, 224, 4, 144,
		4, 74, 74, 74, 74, 41, 15, 29, 40, 2, 168, 185, 0, 5, 133, 220,
		165, 218, 41, 14, 168, 185, 144, 3, 133, 213, 165, 220, 25, 145, 3, 157,
		56, 3, 189, 184, 2, 240, 40, 201, 1, 208, 33, 189, 56, 2, 24, 125,
		216, 2, 24, 188, 192, 2, 121, 165, 3, 157, 56, 2, 200, 152, 221, 208,
		2, 208, 3, 189, 200, 2, 157, 192, 2, 76, 185, 8, 222, 184, 2, 188,
		0, 3, 192, 13, 144, 60, 189, 16, 3, 16, 49, 152, 221, 248, 2, 208,
		8, 189, 8, 3, 157, 248, 2, 208, 3, 254, 248, 2, 189, 112, 2, 133,
		215, 189, 120, 2, 133, 216, 188, 248, 2, 177, 215, 188, 232, 2, 240, 4,
		24, 125, 240, 2, 157, 240, 2, 189, 224, 2, 41, 63, 56, 233, 1, 157,
		16, 3, 189, 152, 2, 16, 31, 189, 40, 2, 240, 26, 221, 176, 2, 240,
		21, 144, 19, 168, 189, 168, 2, 24, 125, 160, 2, 157, 168, 2, 144, 6,
		152, 233, 16, 157, 40, 2, 169, 0, 133, 221, 165, 218, 157, 24, 3, 41,
		112, 74, 74, 141, 49, 9, 144, 254, 76, 231, 9, 234, 76, 81, 9, 234,
		76, 86, 9, 234, 76, 96, 9, 234, 76, 108, 9, 234, 76, 123, 9, 234,
		76, 190, 9, 234, 76, 205, 9, 165, 219, 76, 42, 10, 165, 219, 133, 221,
		189, 32, 2, 76, 237, 9, 189, 32, 2, 24, 101, 219, 157, 32, 2, 76,
		237, 9, 189, 56, 2, 24, 101, 219, 157, 56, 2, 189, 32, 2, 76, 237,
		9, 189, 224, 2, 16, 12, 188, 32, 2, 177, 213, 24, 125, 240, 2, 76,
		156, 9, 189, 32, 2, 24, 125, 240, 2, 201, 61, 144, 2, 169, 63, 168,
		177, 213, 157, 64, 2, 164, 219, 208, 3, 157, 72, 2, 152, 74, 74, 74,
		74, 157, 80, 2, 157, 88, 2, 165, 219, 41, 15, 157, 96, 2, 189, 32,
		2, 76, 237, 9, 165, 219, 24, 125, 40, 3, 157, 40, 3, 189, 32, 2,
		76, 237, 9, 165, 219, 201, 128, 240, 6, 157, 32, 2, 76, 237, 9, 189,
		56, 3, 9, 240, 157, 56, 3, 189, 32, 2, 76, 237, 9, 189, 32, 2,
		24, 101, 219, 188, 224, 2, 48, 31, 24, 125, 240, 2, 201, 61, 144, 7,
		169, 0, 157, 56, 3, 169, 63, 157, 32, 3, 168, 177, 213, 24, 125, 56,
		2, 24, 101, 221, 76, 42, 10, 201, 61, 144, 7, 169, 0, 157, 56, 3,
		169, 63, 168, 189, 56, 2, 24, 125, 240, 2, 24, 113, 213, 24, 101, 221,
		157, 48, 3, 189, 88, 2, 240, 50, 222, 88, 2, 208, 45, 189, 80, 2,
		157, 88, 2, 189, 72, 2, 221, 64, 2, 240, 31, 176, 13, 125, 96, 2,
		176, 18, 221, 64, 2, 176, 13, 76, 97, 10, 253, 96, 2, 144, 5, 221,
		64, 2, 176, 3, 189, 64, 2, 157, 72, 2, 165, 218, 41, 1, 240, 10,
		189, 72, 2, 24, 125, 56, 2, 157, 48, 3, 202, 48, 3, 76, 52, 8,
		173, 64, 3, 13, 65, 3, 13, 66, 3, 13, 67, 3, 170, 142, 101, 12,
		173, 24, 3, 16, 33, 173, 56, 3, 41, 15, 240, 26, 173, 48, 3, 24,
		109, 40, 3, 141, 50, 3, 173, 58, 3, 41, 16, 208, 5, 169, 0, 141,
		58, 3, 138, 9, 4, 170, 173, 25, 3, 16, 33, 173, 57, 3, 41, 15,
		240, 26, 173, 49, 3, 24, 109, 41, 3, 141, 51, 3, 173, 59, 3, 41,
		16, 208, 5, 169, 0, 141, 59, 3, 138, 9, 2, 170, 236, 101, 12, 208,
		94, 173, 25, 3, 41, 14, 201, 6, 208, 38, 173, 57, 3, 41, 15, 240,
		31, 172, 33, 3, 185, 192, 3, 141, 48, 3, 185, 192, 4, 141, 49, 3,
		173, 56, 3, 41, 16, 208, 5, 169, 0, 141, 56, 3, 138, 9, 80, 170,
		173, 27, 3, 41, 14, 201, 6, 208, 38, 173, 59, 3, 41, 15, 240, 31,
		172, 35, 3, 185, 192, 3, 141, 50, 3, 185, 192, 4, 141, 51, 3, 173,
		58, 3, 41, 16, 208, 5, 169, 0, 141, 58, 3, 138, 9, 40, 170, 142,
		101, 12, 173, 68, 3, 13, 69, 3, 13, 70, 3, 13, 71, 3, 170, 142,
		3, 12, 173, 28, 3, 16, 33, 173, 60, 3, 41, 15, 240, 26, 173, 52,
		3, 24, 109, 44, 3, 141, 54, 3, 173, 62, 3, 41, 16, 208, 5, 169,
		0, 141, 62, 3, 138, 9, 4, 170, 173, 29, 3, 16, 33, 173, 61, 3,
		41, 15, 240, 26, 173, 53, 3, 24, 109, 45, 3, 141, 55, 3, 173, 63,
		3, 41, 16, 208, 5, 169, 0, 141, 63, 3, 138, 9, 2, 170, 236, 3,
		12, 208, 94, 173, 29, 3, 41, 14, 201, 6, 208, 38, 173, 61, 3, 41,
		15, 240, 31, 172, 37, 3, 185, 192, 3, 141, 52, 3, 185, 192, 4, 141,
		53, 3, 173, 60, 3, 41, 16, 208, 5, 169, 0, 141, 60, 3, 138, 9,
		80, 170, 173, 31, 3, 41, 14, 201, 6, 208, 38, 173, 63, 3, 41, 15,
		240, 31, 172, 39, 3, 185, 192, 3, 141, 54, 3, 185, 192, 4, 141, 55,
		3, 173, 62, 3, 41, 16, 208, 5, 169, 0, 141, 62, 3, 138, 9, 40,
		170, 142, 3, 12, 173, 74, 3, 96, 160, 255, 173, 52, 3, 174, 48, 3,
		141, 16, 210, 142, 0, 210, 173, 60, 3, 174, 56, 3, 141, 17, 210, 142,
		1, 210, 173, 53, 3, 174, 49, 3, 141, 18, 210, 142, 2, 210, 173, 61,
		3, 174, 57, 3, 141, 19, 210, 142, 3, 210, 173, 54, 3, 174, 50, 3,
		141, 20, 210, 142, 4, 210, 173, 62, 3, 174, 58, 3, 141, 21, 210, 142,
		5, 210, 173, 55, 3, 174, 51, 3, 141, 22, 210, 142, 6, 210, 173, 63,
		3, 174, 59, 3, 141, 23, 210, 142, 7, 210, 169, 255, 140, 24, 210, 141,
		8, 210, 96 ]);
	static tm2_obx = new Uint8Array([
		255, 255, 0, 5, 107, 19, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
		1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
		1, 1, 2, 2, 2, 2, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2,
		2, 2, 2, 3, 3, 3, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
		3, 3, 3, 3, 4, 4, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3,
		3, 4, 4, 4, 5, 5, 0, 0, 1, 1, 2, 2, 2, 3, 3, 4,
		4, 4, 5, 5, 6, 6, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4,
		5, 5, 6, 6, 7, 7, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5,
		5, 6, 6, 7, 7, 8, 0, 1, 1, 2, 2, 3, 4, 4, 5, 5,
		6, 7, 7, 8, 8, 9, 0, 1, 1, 2, 3, 3, 4, 5, 5, 6,
		7, 7, 8, 9, 9, 10, 0, 1, 1, 2, 3, 4, 4, 5, 6, 7,
		7, 8, 9, 10, 10, 11, 0, 1, 2, 2, 3, 4, 5, 6, 6, 7,
		8, 9, 10, 10, 11, 12, 0, 1, 2, 3, 3, 4, 5, 6, 7, 8,
		9, 10, 10, 11, 12, 13, 0, 1, 2, 3, 4, 5, 6, 7, 7, 8,
		9, 10, 11, 12, 13, 14, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
		10, 11, 12, 13, 14, 15, 0, 241, 228, 215, 203, 192, 181, 170, 161, 152,
		143, 135, 127, 120, 114, 107, 101, 95, 90, 85, 80, 75, 71, 67, 63, 60,
		56, 53, 50, 47, 44, 42, 39, 37, 35, 33, 31, 29, 28, 26, 24, 23,
		22, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
		5, 4, 3, 2, 1, 0, 0, 242, 233, 218, 206, 191, 182, 170, 161, 152,
		143, 137, 128, 122, 113, 107, 101, 95, 92, 86, 80, 77, 71, 68, 62, 60,
		56, 53, 50, 47, 45, 42, 40, 37, 35, 33, 31, 29, 28, 26, 24, 23,
		22, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
		5, 4, 3, 2, 1, 0, 0, 255, 241, 228, 216, 202, 192, 181, 171, 162,
		153, 142, 135, 127, 121, 115, 112, 102, 97, 90, 85, 82, 75, 72, 67, 63,
		60, 57, 55, 51, 48, 45, 42, 40, 37, 36, 33, 31, 30, 28, 27, 25,
		23, 22, 21, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7,
		6, 5, 4, 3, 2, 1, 0, 243, 230, 217, 204, 193, 181, 173, 162, 153,
		144, 136, 128, 121, 114, 108, 102, 96, 91, 85, 81, 76, 72, 68, 64, 60,
		57, 53, 50, 47, 45, 42, 40, 37, 35, 33, 31, 29, 28, 26, 24, 23,
		22, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
		5, 4, 3, 2, 1, 0, 226, 56, 140, 0, 106, 232, 106, 239, 128, 8,
		174, 70, 230, 149, 65, 246, 176, 110, 48, 246, 187, 132, 82, 34, 244, 200,
		160, 122, 85, 52, 20, 245, 216, 189, 164, 141, 119, 96, 78, 56, 39, 21,
		6, 247, 232, 219, 207, 195, 184, 172, 162, 154, 144, 136, 127, 120, 112, 106,
		100, 94, 87, 82, 50, 10, 0, 242, 51, 150, 226, 56, 140, 0, 106, 232,
		106, 239, 128, 8, 174, 70, 230, 149, 65, 246, 176, 110, 48, 246, 187, 132,
		82, 34, 244, 200, 160, 122, 85, 52, 20, 245, 216, 189, 164, 141, 119, 96,
		78, 56, 39, 21, 6, 247, 232, 219, 207, 195, 184, 172, 162, 154, 144, 136,
		127, 120, 112, 106, 100, 94, 11, 11, 10, 10, 9, 8, 8, 7, 7, 7,
		6, 6, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2,
		2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
		1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 13, 13, 12, 11, 11, 10, 10, 9, 8,
		8, 7, 7, 7, 6, 6, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3,
		3, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1,
		1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 76, 228, 16, 76, 227, 9, 76, 159, 11, 1,
		16, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 5,
		6, 7, 0, 1, 2, 3, 4, 2, 0, 0, 4, 2, 0, 0, 0, 16,
		0, 8, 0, 16, 0, 8, 133, 211, 129, 169, 133, 211, 129, 169, 136, 177,
		250, 141, 23, 8, 162, 0, 134, 252, 10, 38, 252, 10, 38, 252, 10, 38,
		252, 10, 38, 252, 109, 23, 8, 144, 2, 230, 252, 24, 105, 0, 133, 250,
		165, 252, 105, 0, 133, 251, 76, 7, 10, 32, 181, 12, 173, 22, 8, 240,
		5, 206, 28, 8, 48, 3, 76, 162, 11, 206, 29, 8, 208, 82, 162, 0,
		238, 23, 8, 173, 25, 8, 133, 250, 173, 26, 8, 133, 251, 160, 16, 177,
		250, 48, 171, 208, 3, 76, 44, 18, 141, 29, 8, 136, 177, 250, 136, 132,
		252, 168, 185, 255, 255, 157, 80, 8, 185, 255, 255, 157, 88, 8, 169, 0,
		157, 112, 8, 157, 96, 8, 164, 252, 177, 250, 157, 104, 8, 232, 136, 16,
		219, 169, 17, 24, 101, 250, 141, 25, 8, 169, 0, 101, 251, 141, 26, 8,
		173, 27, 8, 141, 28, 8, 162, 7, 222, 112, 8, 48, 6, 202, 16, 248,
		76, 162, 11, 189, 80, 8, 133, 250, 189, 88, 8, 133, 251, 188, 96, 8,
		177, 250, 208, 28, 200, 177, 250, 157, 208, 8, 41, 240, 157, 216, 8, 177,
		250, 10, 10, 10, 10, 157, 224, 8, 200, 152, 157, 96, 8, 76, 87, 10,
		201, 64, 176, 79, 125, 104, 8, 157, 152, 8, 200, 177, 250, 16, 37, 41,
		127, 133, 252, 200, 177, 250, 157, 208, 8, 41, 240, 157, 216, 8, 177, 250,
		10, 10, 10, 10, 157, 224, 8, 200, 152, 157, 96, 8, 164, 252, 32, 156,
		18, 76, 87, 10, 168, 254, 96, 8, 254, 96, 8, 189, 208, 8, 41, 240,
		157, 216, 8, 189, 208, 8, 10, 10, 10, 10, 157, 224, 8, 32, 156, 18,
		76, 87, 10, 201, 128, 176, 37, 41, 63, 24, 125, 104, 8, 157, 152, 8,
		200, 177, 250, 157, 208, 8, 41, 240, 157, 216, 8, 177, 250, 10, 10, 10,
		10, 157, 224, 8, 200, 152, 157, 96, 8, 76, 87, 10, 208, 14, 200, 177,
		250, 157, 112, 8, 200, 152, 157, 96, 8, 76, 87, 10, 201, 192, 176, 15,
		41, 63, 24, 125, 104, 8, 157, 152, 8, 254, 96, 8, 76, 87, 10, 201,
		208, 176, 15, 200, 254, 96, 8, 41, 15, 141, 27, 8, 141, 28, 8, 76,
		106, 10, 201, 224, 176, 22, 177, 250, 133, 252, 200, 177, 250, 133, 253, 200,
		152, 157, 96, 8, 165, 252, 32, 14, 17, 76, 87, 10, 201, 240, 176, 46,
		177, 250, 133, 252, 200, 177, 250, 133, 253, 165, 252, 32, 14, 17, 188, 96,
		8, 200, 200, 177, 250, 157, 208, 8, 41, 240, 157, 216, 8, 177, 250, 10,
		10, 10, 10, 157, 224, 8, 200, 152, 157, 96, 8, 76, 87, 10, 201, 255,
		176, 11, 233, 239, 157, 112, 8, 254, 96, 8, 76, 87, 10, 169, 64, 157,
		112, 8, 76, 87, 10, 32, 181, 12, 162, 7, 189, 120, 8, 240, 115, 76,
		217, 13, 189, 14, 8, 240, 14, 169, 0, 157, 32, 8, 157, 40, 8, 202,
		16, 232, 76, 31, 12, 164, 253, 185, 0, 6, 24, 101, 252, 157, 56, 8,
		152, 157, 160, 8, 189, 176, 8, 61, 168, 9, 240, 40, 165, 253, 41, 127,
		168, 185, 0, 7, 24, 101, 252, 157, 55, 8, 185, 128, 7, 105, 0, 157,
		56, 8, 169, 0, 157, 31, 8, 188, 152, 9, 153, 39, 8, 202, 202, 16,
		169, 76, 31, 12, 189, 176, 8, 61, 160, 9, 240, 22, 189, 104, 9, 24,
		101, 253, 157, 162, 8, 168, 185, 0, 6, 24, 101, 252, 56, 101, 254, 157,
		58, 8, 202, 16, 133, 232, 134, 252, 162, 3, 173, 9, 8, 240, 6, 41,
		64, 208, 60, 162, 7, 138, 168, 185, 32, 8, 208, 12, 188, 152, 9, 185,
		40, 8, 208, 4, 138, 168, 169, 0, 25, 168, 8, 157, 48, 8, 185, 56,
		8, 157, 72, 8, 185, 160, 8, 157, 64, 8, 185, 176, 8, 5, 252, 133,
		252, 224, 4, 208, 3, 141, 31, 8, 202, 16, 202, 141, 30, 8, 96, 189,
		32, 8, 29, 168, 8, 157, 48, 8, 189, 44, 8, 29, 172, 8, 157, 52,
		8, 189, 56, 8, 157, 72, 8, 189, 60, 8, 157, 76, 8, 189, 160, 8,
		157, 64, 8, 189, 164, 8, 157, 68, 8, 202, 16, 211, 173, 176, 8, 13,
		177, 8, 13, 178, 8, 13, 179, 8, 141, 30, 8, 173, 180, 8, 13, 181,
		8, 13, 182, 8, 13, 183, 8, 141, 31, 8, 96, 173, 9, 8, 208, 3,
		76, 144, 13, 48, 3, 76, 72, 13, 173, 13, 8, 170, 74, 74, 41, 1,
		168, 185, 30, 8, 141, 56, 210, 138, 41, 4, 168, 185, 56, 8, 141, 48,
		210, 189, 32, 8, 141, 49, 210, 185, 57, 8, 141, 50, 210, 189, 33, 8,
		141, 51, 210, 185, 58, 8, 141, 52, 210, 189, 34, 8, 141, 53, 210, 185,
		59, 8, 141, 54, 210, 189, 35, 8, 141, 55, 210, 173, 12, 8, 170, 74,
		74, 41, 1, 168, 185, 30, 8, 141, 40, 210, 138, 41, 4, 168, 185, 56,
		8, 141, 32, 210, 189, 32, 8, 141, 33, 210, 185, 57, 8, 141, 34, 210,
		189, 33, 8, 141, 35, 210, 185, 58, 8, 141, 36, 210, 189, 34, 8, 141,
		37, 210, 185, 59, 8, 141, 38, 210, 189, 35, 8, 141, 39, 210, 173, 11,
		8, 170, 74, 74, 41, 1, 168, 185, 30, 8, 141, 24, 210, 138, 172, 9,
		8, 16, 2, 41, 4, 168, 185, 56, 8, 141, 16, 210, 189, 32, 8, 141,
		17, 210, 185, 57, 8, 141, 18, 210, 189, 33, 8, 141, 19, 210, 185, 58,
		8, 141, 20, 210, 189, 34, 8, 141, 21, 210, 185, 59, 8, 141, 22, 210,
		189, 35, 8, 141, 23, 210, 173, 10, 8, 170, 74, 74, 41, 1, 168, 185,
		30, 8, 141, 8, 210, 138, 172, 9, 8, 16, 2, 41, 4, 168, 185, 56,
		8, 141, 0, 210, 189, 32, 8, 141, 1, 210, 185, 57, 8, 141, 2, 210,
		189, 33, 8, 141, 3, 210, 185, 58, 8, 141, 4, 210, 189, 34, 8, 141,
		5, 210, 185, 59, 8, 141, 6, 210, 189, 35, 8, 141, 7, 210, 96, 189,
		128, 8, 133, 250, 189, 136, 8, 133, 251, 189, 128, 9, 133, 252, 189, 136,
		9, 133, 253, 189, 144, 9, 133, 254, 189, 184, 8, 221, 192, 8, 144, 12,
		157, 8, 9, 189, 200, 8, 157, 184, 8, 76, 11, 14, 189, 8, 9, 240,
		48, 189, 232, 8, 240, 19, 222, 248, 8, 208, 14, 157, 248, 8, 189, 216,
		8, 240, 6, 56, 233, 16, 157, 216, 8, 189, 240, 8, 240, 19, 222, 0,
		9, 208, 14, 157, 0, 9, 189, 224, 8, 240, 6, 56, 233, 16, 157, 224,
		8, 188, 72, 9, 177, 250, 24, 125, 152, 8, 24, 101, 253, 133, 253, 222,
		88, 9, 16, 57, 189, 80, 9, 157, 88, 9, 189, 96, 9, 240, 30, 24,
		125, 72, 9, 157, 72, 9, 240, 13, 221, 64, 9, 144, 32, 169, 255, 157,
		96, 9, 76, 135, 14, 169, 1, 157, 96, 9, 76, 135, 14, 254, 72, 9,
		189, 64, 9, 221, 72, 9, 176, 5, 169, 0, 157, 72, 9, 169, 19, 24,
		101, 250, 133, 250, 144, 2, 230, 251, 188, 184, 8, 177, 250, 41, 240, 157,
		168, 8, 177, 250, 41, 15, 29, 216, 8, 168, 185, 0, 5, 5, 255, 168,
		185, 0, 5, 157, 32, 8, 188, 184, 8, 200, 177, 250, 41, 15, 29, 224,
		8, 168, 185, 0, 5, 5, 255, 168, 185, 0, 5, 157, 40, 8, 189, 40,
		9, 208, 39, 189, 16, 9, 141, 212, 14, 16, 254, 76, 209, 15, 234, 76,
		108, 15, 234, 76, 167, 15, 234, 76, 212, 15, 234, 76, 1, 16, 234, 76,
		33, 16, 234, 76, 65, 16, 234, 76, 73, 16, 222, 40, 9, 188, 184, 8,
		200, 177, 250, 41, 112, 74, 74, 74, 141, 34, 15, 177, 250, 48, 6, 189,
		112, 9, 76, 18, 15, 189, 120, 9, 61, 176, 9, 157, 176, 8, 200, 200,
		152, 157, 184, 8, 136, 177, 250, 144, 254, 144, 22, 144, 12, 144, 34, 144,
		24, 144, 46, 144, 36, 144, 50, 144, 52, 125, 128, 9, 157, 128, 9, 177,
		250, 24, 101, 252, 133, 252, 76, 172, 11, 125, 136, 9, 157, 136, 9, 177,
		250, 24, 101, 253, 133, 253, 76, 172, 11, 125, 144, 9, 157, 144, 9, 177,
		250, 24, 101, 254, 133, 254, 76, 172, 11, 133, 252, 169, 0, 133, 253, 76,
		172, 11, 189, 32, 9, 41, 3, 74, 144, 10, 208, 25, 189, 24, 9, 24,
		101, 252, 133, 252, 222, 56, 9, 16, 78, 254, 32, 9, 189, 48, 9, 157,
		56, 9, 76, 247, 14, 165, 252, 253, 24, 9, 133, 252, 222, 56, 9, 16,
		54, 254, 32, 9, 189, 48, 9, 157, 56, 9, 76, 247, 14, 188, 32, 9,
		189, 24, 9, 48, 2, 200, 200, 136, 152, 24, 101, 252, 133, 252, 222, 56,
		9, 16, 20, 152, 157, 32, 9, 221, 24, 9, 208, 5, 73, 255, 157, 24,
		9, 189, 48, 9, 157, 56, 9, 76, 247, 14, 188, 32, 9, 189, 24, 9,
		48, 2, 200, 200, 136, 152, 24, 101, 253, 133, 253, 222, 56, 9, 16, 231,
		152, 157, 32, 9, 221, 24, 9, 208, 216, 73, 255, 157, 24, 9, 189, 48,
		9, 157, 56, 9, 76, 247, 14, 189, 32, 9, 24, 101, 252, 133, 252, 222,
		56, 9, 16, 195, 189, 24, 9, 24, 125, 32, 9, 157, 32, 9, 189, 48,
		9, 157, 56, 9, 76, 247, 14, 165, 253, 56, 253, 32, 9, 133, 253, 222,
		56, 9, 16, 163, 189, 24, 9, 24, 125, 32, 9, 157, 32, 9, 189, 48,
		9, 157, 56, 9, 76, 247, 14, 189, 24, 9, 24, 101, 252, 133, 252, 76,
		247, 14, 160, 16, 169, 0, 133, 250, 169, 0, 133, 251, 169, 0, 141, 23,
		8, 138, 240, 63, 177, 250, 240, 2, 16, 1, 202, 169, 17, 24, 101, 250,
		133, 250, 144, 2, 230, 251, 238, 23, 8, 208, 230, 162, 0, 169, 0, 133,
		252, 138, 141, 23, 8, 10, 38, 252, 10, 38, 252, 10, 38, 252, 10, 38,
		252, 109, 23, 8, 144, 2, 230, 252, 24, 105, 0, 133, 250, 165, 252, 105,
		0, 133, 251, 32, 44, 18, 165, 250, 141, 25, 8, 165, 251, 141, 26, 8,
		162, 7, 169, 255, 157, 208, 8, 169, 240, 157, 216, 8, 157, 224, 8, 202,
		16, 240, 169, 3, 141, 15, 210, 141, 31, 210, 141, 47, 210, 141, 63, 210,
		206, 23, 8, 232, 142, 28, 8, 232, 142, 29, 8, 142, 22, 8, 96, 138,
		41, 15, 141, 27, 8, 96, 142, 22, 8, 96, 201, 16, 176, 3, 76, 76,
		16, 201, 32, 144, 136, 201, 48, 176, 3, 76, 133, 18, 201, 64, 144, 223,
		201, 80, 176, 3, 76, 44, 18, 201, 96, 144, 219, 201, 112, 144, 3, 76,
		180, 17, 132, 253, 41, 15, 10, 141, 23, 17, 165, 253, 144, 254, 144, 30,
		144, 56, 144, 89, 144, 96, 144, 26, 144, 28, 144, 30, 144, 32, 144, 34,
		144, 36, 144, 13, 144, 11, 144, 9, 144, 7, 144, 5, 144, 3, 141, 24,
		8, 96, 157, 104, 9, 96, 157, 112, 9, 96, 157, 120, 9, 96, 157, 144,
		9, 96, 157, 128, 9, 96, 157, 136, 9, 96, 41, 112, 74, 74, 157, 16,
		9, 41, 48, 208, 3, 157, 32, 9, 165, 253, 48, 6, 41, 15, 157, 24,
		9, 96, 41, 15, 73, 255, 24, 105, 1, 157, 24, 9, 96, 41, 63, 157,
		48, 9, 157, 56, 9, 96, 41, 128, 10, 42, 157, 96, 9, 165, 253, 41,
		112, 74, 74, 74, 74, 157, 64, 9, 208, 3, 157, 96, 9, 165, 253, 41,
		15, 157, 80, 9, 157, 88, 9, 189, 72, 9, 221, 64, 9, 144, 143, 189,
		64, 9, 240, 2, 233, 1, 157, 72, 9, 96, 132, 250, 134, 251, 160, 25,
		177, 250, 200, 141, 9, 8, 177, 250, 200, 141, 10, 8, 177, 250, 200, 141,
		11, 8, 177, 250, 200, 141, 12, 8, 177, 250, 200, 141, 13, 8, 177, 250,
		141, 27, 8, 165, 250, 73, 128, 48, 1, 232, 141, 172, 18, 142, 173, 18,
		73, 128, 48, 1, 232, 141, 29, 10, 142, 30, 10, 232, 141, 35, 10, 142,
		36, 10, 232, 141, 162, 18, 142, 163, 18, 73, 128, 48, 1, 232, 141, 25,
		8, 141, 215, 9, 141, 79, 16, 141, 148, 16, 142, 26, 8, 142, 221, 9,
		142, 83, 16, 142, 154, 16, 169, 240, 133, 255, 169, 0, 141, 22, 8, 141,
		24, 8, 162, 7, 169, 0, 141, 22, 8, 157, 120, 8, 157, 176, 8, 157,
		32, 8, 157, 40, 8, 157, 48, 8, 157, 48, 210, 157, 32, 210, 157, 16,
		210, 157, 0, 210, 202, 16, 226, 141, 24, 210, 141, 8, 210, 141, 56, 210,
		141, 40, 210, 141, 30, 8, 141, 31, 8, 96, 157, 32, 8, 157, 40, 8,
		157, 48, 8, 157, 176, 8, 96, 152, 157, 208, 8, 41, 240, 157, 216, 8,
		189, 208, 8, 10, 10, 10, 10, 157, 224, 8, 96, 41, 7, 133, 250, 138,
		166, 250, 41, 63, 240, 225, 157, 152, 8, 152, 48, 238, 189, 208, 8, 32,
		117, 18, 169, 0, 157, 120, 8, 185, 255, 255, 240, 190, 157, 136, 8, 133,
		251, 185, 255, 255, 157, 128, 8, 133, 250, 152, 157, 144, 8, 160, 8, 177,
		250, 200, 157, 192, 8, 177, 250, 200, 157, 200, 8, 177, 250, 200, 157, 104,
		9, 177, 250, 200, 157, 112, 9, 177, 250, 200, 157, 120, 9, 177, 250, 200,
		157, 232, 8, 157, 248, 8, 177, 250, 200, 157, 240, 8, 157, 0, 9, 177,
		250, 41, 112, 74, 74, 157, 16, 9, 177, 250, 200, 48, 8, 41, 15, 157,
		24, 9, 76, 9, 19, 41, 15, 73, 255, 24, 105, 1, 157, 24, 9, 177,
		250, 200, 157, 40, 9, 177, 250, 200, 41, 63, 157, 48, 9, 157, 56, 9,
		177, 250, 41, 128, 10, 42, 157, 96, 9, 177, 250, 41, 112, 74, 74, 74,
		74, 157, 64, 9, 208, 3, 157, 96, 9, 177, 250, 136, 41, 15, 157, 80,
		9, 157, 88, 9, 177, 250, 41, 192, 29, 152, 8, 157, 152, 8, 168, 185,
		0, 6, 157, 56, 8, 169, 0, 157, 184, 8, 157, 32, 9, 157, 8, 9,
		157, 72, 9, 157, 128, 9, 157, 136, 9, 157, 144, 9, 169, 1, 157, 120,
		8, 96 ]);
	static tmc_obx = new Uint8Array([
		255, 255, 0, 5, 104, 15, 76, 206, 13, 76, 208, 8, 76, 239, 9, 15,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
		1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2,
		2, 2, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3,
		3, 3, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3,
		4, 4, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4,
		5, 5, 0, 0, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5, 5,
		6, 6, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
		7, 7, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7,
		7, 8, 0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 7, 7, 8,
		8, 9, 0, 1, 1, 2, 3, 3, 4, 5, 5, 6, 7, 7, 8, 9,
		9, 10, 0, 1, 1, 2, 3, 4, 4, 5, 6, 7, 7, 8, 9, 10,
		10, 11, 0, 1, 2, 2, 3, 4, 5, 6, 6, 7, 8, 9, 10, 10,
		11, 12, 0, 1, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11,
		12, 13, 0, 1, 2, 3, 4, 5, 6, 7, 7, 8, 9, 10, 11, 12,
		13, 14, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
		14, 15, 0, 241, 228, 215, 203, 192, 181, 170, 161, 152, 143, 135, 127, 120,
		114, 107, 101, 95, 90, 85, 80, 75, 71, 67, 63, 60, 56, 53, 50, 47,
		44, 42, 39, 37, 35, 33, 31, 29, 28, 26, 24, 23, 22, 20, 19, 18,
		17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
		1, 0, 0, 242, 230, 218, 206, 191, 182, 170, 161, 152, 143, 137, 128, 122,
		113, 107, 101, 95, 92, 86, 80, 77, 71, 68, 62, 60, 56, 53, 50, 47,
		45, 42, 40, 37, 35, 33, 31, 29, 28, 26, 24, 23, 22, 20, 19, 18,
		17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
		1, 0, 0, 255, 241, 228, 216, 202, 192, 181, 171, 162, 153, 142, 135, 127,
		121, 115, 112, 102, 97, 90, 85, 82, 75, 72, 67, 63, 60, 57, 55, 51,
		48, 45, 42, 40, 37, 36, 33, 31, 30, 28, 27, 25, 23, 22, 21, 19,
		18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
		2, 1, 0, 243, 230, 217, 204, 193, 181, 173, 162, 153, 144, 136, 128, 121,
		114, 108, 102, 96, 91, 85, 81, 76, 72, 68, 64, 60, 57, 53, 50, 47,
		45, 42, 40, 37, 35, 33, 31, 29, 28, 26, 24, 23, 22, 20, 19, 18,
		17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
		1, 0, 0, 242, 51, 150, 226, 56, 140, 0, 106, 232, 106, 239, 128, 8,
		174, 70, 230, 149, 65, 246, 176, 110, 48, 246, 187, 132, 82, 34, 244, 200,
		160, 122, 85, 52, 20, 245, 216, 189, 164, 141, 119, 96, 78, 56, 39, 21,
		6, 247, 232, 219, 207, 195, 184, 172, 162, 154, 144, 136, 127, 120, 112, 106,
		100, 94, 0, 13, 13, 12, 11, 11, 10, 10, 9, 8, 8, 7, 7, 7,
		6, 6, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2,
		2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
		1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 5,
		6, 7, 0, 1, 2, 3, 4, 2, 0, 0, 4, 2, 0, 0, 0, 16,
		0, 8, 0, 16, 0, 8, 173, 183, 8, 240, 94, 173, 182, 8, 201, 64,
		144, 90, 206, 181, 8, 240, 3, 76, 239, 9, 162, 7, 169, 0, 157, 196,
		7, 157, 204, 7, 202, 16, 247, 141, 182, 8, 170, 160, 15, 177, 254, 16,
		32, 136, 177, 254, 16, 3, 76, 95, 14, 134, 252, 10, 10, 38, 252, 10,
		38, 252, 10, 38, 252, 105, 0, 133, 254, 165, 252, 105, 0, 133, 255, 144,
		218, 157, 212, 7, 136, 177, 254, 157, 220, 7, 232, 136, 16, 207, 24, 165,
		254, 105, 16, 133, 254, 144, 2, 230, 255, 76, 239, 9, 206, 181, 8, 16,
		248, 238, 182, 8, 173, 180, 8, 141, 181, 8, 162, 7, 222, 204, 7, 48,
		3, 76, 233, 9, 188, 212, 7, 185, 255, 255, 133, 252, 185, 255, 255, 133,
		253, 188, 196, 7, 177, 252, 208, 6, 32, 109, 13, 76, 230, 9, 201, 64,
		176, 18, 125, 220, 7, 157, 228, 7, 32, 109, 13, 188, 42, 5, 32, 188,
		14, 76, 230, 9, 208, 34, 200, 254, 196, 7, 177, 252, 16, 7, 133, 251,
		32, 109, 13, 165, 251, 41, 127, 208, 7, 169, 64, 141, 182, 8, 208, 76,
		141, 180, 8, 141, 181, 8, 208, 68, 201, 128, 176, 43, 41, 63, 125, 220,
		7, 157, 228, 7, 200, 254, 196, 7, 177, 252, 41, 127, 208, 7, 169, 64,
		141, 182, 8, 208, 6, 141, 180, 8, 141, 181, 8, 32, 109, 13, 188, 42,
		5, 32, 188, 14, 76, 230, 9, 201, 192, 176, 12, 41, 63, 157, 42, 5,
		200, 254, 196, 7, 76, 94, 9, 41, 63, 157, 204, 7, 254, 196, 7, 202,
		48, 3, 76, 70, 9, 162, 7, 189, 188, 7, 240, 33, 32, 46, 11, 189,
		50, 5, 61, 192, 8, 240, 22, 160, 71, 177, 252, 24, 125, 34, 5, 157,
		36, 5, 168, 185, 60, 6, 56, 125, 100, 8, 157, 246, 7, 202, 16, 215,
		14, 9, 5, 14, 9, 5, 14, 9, 5, 14, 9, 5, 232, 134, 252, 134,
		253, 162, 7, 138, 168, 185, 252, 7, 208, 12, 188, 184, 8, 185, 4, 8,
		208, 4, 138, 168, 169, 0, 133, 250, 152, 157, 26, 5, 185, 244, 7, 157,
		18, 5, 185, 50, 5, 133, 251, 5, 253, 133, 253, 165, 251, 61, 192, 8,
		240, 6, 185, 246, 7, 157, 20, 5, 165, 251, 61, 200, 8, 240, 18, 185,
		34, 5, 41, 63, 168, 200, 132, 252, 185, 123, 7, 157, 18, 5, 76, 137,
		10, 164, 252, 240, 10, 185, 59, 7, 157, 18, 5, 169, 0, 133, 252, 165,
		250, 13, 9, 5, 168, 185, 60, 5, 188, 26, 5, 25, 236, 7, 157, 10,
		5, 224, 4, 208, 9, 165, 253, 141, 59, 5, 169, 0, 133, 253, 202, 16,
		130, 78, 9, 5, 78, 9, 5, 78, 9, 5, 78, 9, 5, 165, 253, 162,
		3, 142, 31, 210, 142, 15, 210, 174, 22, 5, 172, 18, 5, 142, 16, 210,
		140, 0, 210, 174, 14, 5, 172, 10, 5, 142, 17, 210, 140, 1, 210, 174,
		23, 5, 172, 19, 5, 142, 18, 210, 140, 2, 210, 174, 15, 5, 172, 11,
		5, 142, 19, 210, 140, 3, 210, 174, 24, 5, 172, 20, 5, 142, 20, 210,
		140, 4, 210, 174, 16, 5, 172, 12, 5, 142, 21, 210, 140, 5, 210, 174,
		25, 5, 172, 21, 5, 142, 22, 210, 140, 6, 210, 174, 17, 5, 172, 13,
		5, 142, 23, 210, 140, 7, 210, 141, 58, 5, 174, 59, 5, 142, 24, 210,
		141, 8, 210, 96, 189, 28, 8, 133, 252, 189, 36, 8, 133, 253, 188, 44,
		8, 192, 63, 240, 123, 254, 44, 8, 254, 44, 8, 254, 44, 8, 177, 252,
		41, 240, 157, 236, 7, 177, 252, 41, 15, 56, 253, 12, 8, 16, 2, 169,
		0, 157, 252, 7, 200, 177, 252, 41, 15, 56, 253, 20, 8, 16, 2, 169,
		0, 157, 4, 8, 177, 252, 41, 240, 240, 116, 16, 11, 160, 73, 177, 252,
		188, 44, 8, 136, 136, 16, 2, 169, 0, 157, 50, 5, 177, 252, 41, 112,
		240, 99, 74, 74, 141, 154, 11, 169, 0, 157, 100, 8, 200, 177, 252, 144,
		254, 234, 234, 234, 234, 76, 56, 13, 234, 76, 53, 13, 234, 76, 60, 13,
		234, 76, 74, 13, 234, 76, 84, 13, 234, 76, 95, 13, 234, 76, 81, 13,
		189, 52, 8, 240, 18, 222, 68, 8, 208, 13, 157, 68, 8, 189, 252, 7,
		41, 15, 240, 3, 222, 252, 7, 189, 60, 8, 240, 18, 222, 76, 8, 208,
		13, 157, 76, 8, 189, 4, 8, 41, 15, 240, 3, 222, 4, 8, 160, 72,
		177, 252, 157, 50, 5, 189, 148, 8, 24, 105, 63, 168, 177, 252, 125, 228,
		7, 157, 34, 5, 168, 185, 60, 6, 157, 244, 7, 222, 164, 8, 16, 51,
		189, 156, 8, 157, 164, 8, 189, 172, 8, 240, 24, 24, 125, 148, 8, 157,
		148, 8, 240, 7, 221, 140, 8, 208, 26, 169, 254, 24, 105, 1, 157, 172,
		8, 208, 16, 254, 148, 8, 189, 140, 8, 221, 148, 8, 176, 5, 169, 0,
		157, 148, 8, 189, 116, 8, 240, 4, 222, 116, 8, 96, 189, 108, 8, 133,
		250, 189, 92, 8, 133, 251, 32, 105, 12, 222, 132, 8, 16, 16, 165, 250,
		157, 108, 8, 165, 251, 157, 92, 8, 189, 124, 8, 157, 132, 8, 96, 189,
		84, 8, 141, 112, 12, 16, 254, 76, 167, 12, 234, 76, 144, 12, 234, 76,
		174, 12, 234, 76, 180, 12, 234, 76, 190, 12, 234, 76, 210, 12, 234, 76,
		226, 12, 234, 76, 244, 12, 165, 250, 230, 250, 41, 3, 74, 144, 15, 208,
		71, 165, 251, 157, 100, 8, 24, 125, 244, 7, 157, 244, 7, 96, 169, 0,
		157, 100, 8, 96, 32, 29, 13, 76, 157, 12, 32, 29, 13, 24, 125, 34,
		5, 76, 84, 13, 165, 250, 157, 100, 8, 24, 125, 244, 7, 157, 244, 7,
		165, 250, 24, 101, 251, 133, 250, 96, 189, 34, 5, 56, 229, 250, 157, 34,
		5, 168, 185, 60, 6, 76, 199, 12, 189, 244, 7, 56, 229, 251, 157, 244,
		7, 56, 169, 0, 229, 251, 157, 100, 8, 96, 189, 132, 8, 208, 174, 165,
		251, 16, 16, 189, 4, 8, 240, 165, 189, 252, 7, 201, 15, 240, 158, 254,
		252, 7, 96, 189, 252, 7, 240, 149, 189, 4, 8, 201, 15, 240, 142, 254,
		4, 8, 96, 164, 250, 165, 251, 48, 2, 200, 200, 136, 152, 133, 250, 197,
		251, 208, 6, 165, 251, 73, 255, 133, 251, 152, 96, 125, 244, 7, 157, 244,
		7, 96, 188, 228, 7, 121, 60, 6, 157, 244, 7, 152, 157, 34, 5, 96,
		45, 10, 210, 157, 244, 7, 96, 125, 228, 7, 157, 34, 5, 168, 185, 60,
		6, 157, 244, 7, 96, 157, 34, 5, 168, 189, 244, 7, 121, 60, 6, 157,
		244, 7, 96, 200, 254, 196, 7, 177, 252, 74, 74, 74, 74, 157, 12, 8,
		177, 252, 41, 15, 157, 20, 8, 96, 32, 95, 14, 160, 15, 169, 0, 133,
		254, 169, 0, 133, 255, 138, 240, 46, 177, 254, 16, 1, 202, 24, 165, 254,
		105, 16, 133, 254, 144, 239, 230, 255, 176, 235, 32, 95, 14, 169, 0, 133,
		252, 138, 10, 10, 38, 252, 10, 38, 252, 10, 38, 252, 105, 0, 133, 254,
		165, 252, 105, 0, 133, 255, 169, 64, 141, 182, 8, 169, 1, 141, 181, 8,
		141, 183, 8, 96, 201, 16, 144, 176, 201, 32, 144, 206, 201, 48, 176, 3,
		76, 174, 14, 201, 64, 176, 9, 138, 41, 15, 240, 3, 141, 180, 8, 96,
		201, 80, 144, 113, 201, 96, 176, 6, 169, 0, 141, 183, 8, 96, 201, 112,
		144, 248, 169, 1, 141, 181, 8, 169, 64, 141, 182, 8, 132, 252, 134, 253,
		160, 30, 177, 252, 141, 180, 8, 165, 252, 24, 105, 32, 141, 194, 14, 144,
		1, 232, 142, 195, 14, 24, 105, 64, 141, 202, 14, 144, 1, 232, 142, 203,
		14, 24, 105, 64, 141, 82, 9, 144, 1, 232, 142, 83, 9, 24, 105, 128,
		141, 87, 9, 144, 1, 232, 142, 88, 9, 24, 105, 128, 133, 254, 141, 16,
		9, 141, 136, 13, 141, 183, 13, 144, 1, 232, 134, 255, 142, 22, 9, 142,
		140, 13, 142, 189, 13, 160, 7, 169, 0, 141, 183, 8, 153, 0, 210, 153,
		16, 210, 153, 10, 5, 153, 252, 7, 153, 4, 8, 153, 50, 5, 153, 188,
		7, 136, 16, 232, 141, 8, 210, 141, 24, 210, 141, 58, 5, 141, 59, 5,
		96, 157, 252, 7, 157, 4, 8, 157, 50, 5, 189, 228, 7, 157, 34, 5,
		96, 152, 73, 240, 74, 74, 74, 74, 157, 12, 8, 152, 41, 15, 73, 15,
		157, 20, 8, 96, 41, 7, 133, 252, 138, 166, 252, 41, 63, 240, 226, 157,
		228, 7, 169, 0, 157, 188, 7, 185, 255, 255, 157, 28, 8, 133, 252, 185,
		255, 255, 157, 36, 8, 133, 253, 5, 252, 240, 182, 160, 74, 177, 252, 157,
		52, 8, 157, 68, 8, 200, 177, 252, 157, 60, 8, 157, 76, 8, 200, 177,
		252, 41, 112, 74, 74, 157, 84, 8, 177, 252, 41, 15, 157, 92, 8, 177,
		252, 16, 11, 189, 92, 8, 73, 255, 24, 105, 1, 157, 92, 8, 200, 177,
		252, 157, 116, 8, 200, 177, 252, 41, 63, 157, 124, 8, 157, 132, 8, 200,
		177, 252, 41, 128, 240, 2, 169, 1, 157, 172, 8, 177, 252, 41, 112, 74,
		74, 74, 74, 157, 140, 8, 208, 3, 157, 172, 8, 177, 252, 41, 15, 157,
		156, 8, 157, 164, 8, 136, 177, 252, 41, 192, 24, 125, 228, 7, 157, 228,
		7, 157, 34, 5, 168, 185, 60, 6, 157, 244, 7, 169, 0, 157, 44, 8,
		157, 100, 8, 157, 108, 8, 157, 148, 8, 169, 1, 157, 188, 7, 96 ]);

}
