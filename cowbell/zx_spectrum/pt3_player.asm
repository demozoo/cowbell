; Z80 source code for the ZX Protracker 3 player
; (from the Vortex Tracker 2 package)

	org 0x4000

; z80dasm 1.1.2
; command line: z80dasm --origin=49152 -l pt3_player.bin

Release EQU "7"

	ld hl,MDLADDR
	jr pt3_init
	jp play
	jr mute
setup:
	db 0
CrPsPtr:
	dw 0
;Identifier
	db "=VTII PT3 Player r.",Release,"="
checklp:
	ld hl,setup
	set 7,(hl)
	bit 0,(hl)
	ret z	
	pop hl	
	ld hl,DelyCnt
	inc (hl)	
	ld hl,ChanA+CHP_NtSkCn
	inc (hl)	
mute:
	xor a	
	ld h,a	
	ld l,a	 
	ld (AYREGS+AR_AmplA),a
	ld (AYREGS+AR_AmplB),hl
	jp rout_a0
pt3_init:
	ld (modaddr+1),hl
	ld (mdaddr2+1),hl
	push hl	
	ld de,00064h
	add hl,de	
	ld a,(hl)	
	ld (pt3_delay+1),a
	push hl	
	pop ix
	add hl,de	
	ld (CrPsPtr),hl
	ld e,(ix+002h)
	add hl,de	
	inc hl	
	ld (LPosPtr+1),hl
	pop de	
	ld l,(ix+003h)
	ld h,(ix+004h)
	add hl,de	
	ld (PatsPtr+1),hl
	ld hl,000a9h
	add hl,de	
	ld (OrnPtrs+1),hl
	ld hl,00069h
	add hl,de	
	ld (SamPtrs+1),hl
	ld hl,setup
	res 7,(hl)
	
; note table data depacker
	ld de,T_PACK
	ld bc,T1_+(2*49)-1
tp_0:
	ld a,(de)	
	inc de	
	cp 01eh
	jr nc,tp_1
	ld h,a	
	ld a,(de)	
	ld l,a	
	inc de	
	jr tp_2
tp_1:
	push de	
	ld d,000h
	ld e,a	
lc091h:
	add hl,de	
	add hl,de	
	pop de	
tp_2:
	ld a,h	
	ld (bc),a	
	dec bc	
	ld a,l	
	ld (bc),a	
	dec bc	
	sub 0f0h
	jr nz,tp_0
	ld hl,vars
	ld (hl),a	
	ld de,vars+1
	ld bc,VAR0END-vars-1
	ldir
	inc a	
	ld (DelyCnt),a
	ld hl,0f001h
	ld (ChanA+CHP_NtSkCn),hl
	ld (ChanB+CHP_NtSkCn),hl
	ld (ChanC+CHP_NtSkCn),hl
	ld hl,emptysamorn
	ld (AdInPtA+1),hl
	ld (ChanA+CHP_OrnPtr),hl
	ld (ChanB+CHP_OrnPtr),hl
	ld (ChanC+CHP_OrnPtr),hl
	ld (ChanA+CHP_SamPtr),hl
	ld (ChanB+CHP_SamPtr),hl
	ld (ChanC+CHP_SamPtr),hl
	ld a,(ix-057h)
	sub 030h
	jr c,l20
	cp 00ah
	jr c,l21
l20:
	ld a,006h
l21:
	ld (version+1),a
	push af	
	cp 004h
	ld a,(ix-001h)
	rla	
	and 007h
	
;NoteTableCreator (c) Ivan Roshin
;A - NoteTableNumber*2+VersionForNoteTable
;(xx1b - 3.xx..3.4r, xx0b - 3.4x..3.6x..VTII1.0)
	
	ld hl,nt_data
	push de	
	ld d,b	
	add a,a	
	ld e,a	
	add hl,de	
	ld e,(hl)	
	inc hl	
	srl e
	sbc a,a	
	and 0a7h ;#00 (NOP) or #A7 (AND A)
	ld (l3),a
	ex de,hl	
	pop bc	
	add hl,bc	
	ld a,(de)	
	add a,T_ & 0xff
	ld c,a	
	adc a,T_ >> 8
	sub c	
	ld b,a	
	push bc	
	ld de,NT_
	push de	
	ld b,00ch
l1:
	push bc	
	ld c,(hl)	
	inc hl	
	push hl	
	ld b,(hl)	
	push de	
	ex de,hl	
	ld de,00017h
	defb 0ddh
	ld h,008h	;= ld ixh,8
l2:
	srl b
	rr c
l3:
	add hl,de	; will be replaced by AND A or NOP apparently
	ld a,c	
	adc a,d	
	ld (hl),a	
	inc hl	
	ld a,b	
	adc a,d	
	ld (hl),a	
	add hl,de	
	defb 0ddh
	dec h ;= dec ixh
	jr nz, l2
	
	pop de	
	inc de	
	inc de	
	pop hl	
	inc hl	
	pop bc	
	djnz l1
	pop hl	
	pop de	
	ld a,e	
	cp TCOLD_1 & 0xff
	jr nz,corr_1
	ld a,0fdh
	ld (NT_+02eh),a
corr_1:
	ld a,(de)	
	and a	
	jr z,tc_exit
	rra	
	push af	
	add a,a	
	ld c,a	
	add hl,bc	
	pop af	
	jr nc,corr_2
	dec (hl)	
	dec (hl)	
corr_2:
	inc (hl)	
	and a	
	sbc hl,bc
	inc de	
	jr corr_1
tc_exit:
	pop af	
	
;VolTableCreator (c) Ivan Roshin
;A - VersionForVolumeTable (0..4 - 3.xx..3.4x;
;5.. - 3.5x..3.6x..VTII1.0)

	cp 005h
	ld hl,00011h
	ld d,h	
	ld e,h	
	ld a,017h
	jr nc,m1
	dec l	
	ld e,l	
	xor a	
m1:
	ld (m2),a
	ld ix,VT_+16
	ld c,010h
pt3_initv2:
	push hl	
	add hl,de	
	ex de,hl	
	sbc hl,hl
pt3_initv1:
	ld a,l	
m2:
	ld a,l	
	ld a,h	
	adc a,000h
	ld (ix+000h),a
	inc ix
	add hl,de	
	inc c	
	ld a,c	
	and 00fh
	jr nz,pt3_initv1
	pop hl	
	ld a,e	
	cp 077h
	jr nz,m3
	inc e	
m3:
	ld a,c	
	and a	
	jr nz,pt3_initv2
	jp rout_a0
	
; pattern decoder
PD_OrSm:
	ld (ix+008h),000h
	call setorn
	ld a,(bc)	
	inc bc	
	rrca	
pd_sam:
	add a,a	
pd_sam_: ; lc19dh
	ld e,a	
	ld d,000h
SamPtrs:
	ld hl,02121h
	add hl,de	
	ld e,(hl)	
	inc hl	
	ld d,(hl)	
modaddr
	ld hl,02121h
	add hl,de	
	ld (ix+003h),l
	ld (ix+004h),h
	jr pd_loop
pd_vol:
	rlca	
	rlca	
	rlca	
	rlca	
	ld (ix+010h),a
	jr pd_lp2
pd_eoff:
	ld (ix+008h),a
	ld (ix-00ch),a
	jr pd_lp2
pd_SorE:
	dec a	
	jr nz,pd_env
	ld a,(bc)	
	inc bc	
	ld (ix+005h),a
	jr pd_lp2
pd_env:
	call setenv
	jr pd_lp2
pd_orn:
	call setorn
	jr pd_loop
pd_esam:
	ld (ix+008h),a
	ld (ix-00ch),a
	call nz,setenv
	ld a,(bc)	
	inc bc	
	jr pd_sam_
ptdecod:
	ld a,(ix+006h)
	ld (PrNote+1),a
	ld l,(ix-006h)
	ld h,(ix-005h)
	ld (PrSlide+1),hl
pd_loop:
	ld de,02010h
pd_lp2:
	ld a,(bc)	
	inc bc	
	add a,e	
	jr c,PD_OrSm
	add a,d	
	jr z,pd_fin
	jr c,pd_sam
	add a,e	
	jr z,pd_rel
	jr c,pd_vol
	add a,e	
	jr z,pd_eoff
	jr c,pd_SorE
	add a,060h
	jr c,pd_note
	add a,e	
	jr c,pd_orn
	add a,d	
	jr c,pd_nois
	add a,e	
	jr c,pd_esam
	add a,a	
	ld e,a	
	ld hl,spccoms+0FF20h-02000h
	add hl,de	
	ld e,(hl)	
	inc hl	
	ld d,(hl)	
	push de	
	jr pd_loop
pd_nois:
	ld (ns_base),a
	jr pd_lp2
pd_rel:
	res 0,(ix+009h)
	jr pd_res
pd_note:
	ld (ix+006h),a
	set 0,(ix+009h)
	xor a	
pd_res:
	ld (pdsp_+1),sp
	ld sp,ix
	ld h,a	
	ld l,a	
	push hl	
	push hl	
	push hl	
	push hl	
	push hl	
	push hl	
pdsp_
	ld sp,03131h
pd_fin:
	ld a,(ix+005h)
	ld (ix+00fh),a
	ret	
	
c_portm:
	res 2,(ix+009h)
	ld a,(bc)	
	inc bc	
	inc bc	
	inc bc	
	ld (ix+00ah),a
	ld (ix-007h),a
	ld de,NT_
	ld a,(ix+006h)
	ld (ix+007h),a
	add a,a	
	ld l,a	
	ld h,000h
	add hl,de	
	ld a,(hl)	
	inc hl	
	ld h,(hl)	
	ld l,a	
	push hl	
PrNote
	ld a,03eh
	ld (ix+006h),a
	add a,a	
	ld l,a	
	ld h,000h
	add hl,de	
	ld e,(hl)	
	inc hl	
	ld d,(hl)	
	pop hl	
	sbc hl,de
	ld (ix+00dh),l
	ld (ix+00eh),h
	ld e,(ix-006h)
	ld d,(ix-005h)
version
	ld a,03eh
	cp 006h
	jr c,oldprtm
PrSlide
	ld de,01111h
	ld (ix-006h),e
	ld (ix-005h),d
oldprtm:
	ld a,(bc)	
	inc bc	
	ex af,af'	
	ld a,(bc)	
	inc bc	
	and a	
	jr z,nosig
	ex de,hl	
nosig:
	sbc hl,de
	jp p,set_stp
	cpl	
	ex af,af'	
	neg
	ex af,af'	
set_stp:
	ld (ix+00ch),a
	ex af,af'	
	ld (ix+00bh),a
	ld (ix-002h),000h
	ret	
	
c_gliss
	set 2,(ix+009h)
	ld a,(bc)	
	inc bc	
	ld (ix+00ah),a
	and a	
	jr nz,gl36
	ld a,(version+1)
	cp 007h
	sbc a,a	
	inc a	
gl36:
	ld (ix-007h),a
	ld a,(bc)	
	inc bc	
	ex af,af'	
	ld a,(bc)	
	inc bc	
	jr set_stp
	
c_smpos
	ld a,(bc)	
	inc bc	
	ld (ix-00bh),a
	ret	

c_orpos:
	ld a,(bc)	
	inc bc	
	ld (ix-00ch),a
	ret	
	
c_vibrt
	ld a,(bc)	
	inc bc	
	ld (ix-001h),a
	ld (ix-002h),a
	ld a,(bc)	
	inc bc	
	ld (ix+000h),a
	xor a	
	ld (ix-007h),a
	ld (ix-006h),a
	ld (ix-005h),a
	ret	

c_engls
	ld a,(bc)	
	inc bc	
	ld (env_del+1),a
	ld (CurEDel),a
	ld a,(bc)	
	inc bc	
	ld l,a	
	ld a,(bc)	
	inc bc	
	ld h,a	
	ld (ESldAdd+1),hl
	ret	

c_pt3_delay:
	ld a,(bc)	
	inc bc	
	ld (pt3_delay+1),a
	ret	
	
setenv:
	ld (ix+008h),e
	ld (AYREGS+AR_EnvTp),a
	ld a,(bc)	
	inc bc	
	ld h,a	
	ld a,(bc)	
	inc bc	
	ld l,a	
	ld (EnvBase),hl
	xor a	
	ld (ix-00ch),a
	ld (CurEDel),a
	ld h,a	
	ld l,a	
	ld (CurESld),hl
c_nop:
	ret	
setorn:
	add a,a	
	ld e,a	
	ld d,000h
	ld (ix-00ch),d
OrnPtrs:
	ld hl,02121h
	add hl,de	
	ld e,(hl)	
	inc hl	
	ld d,(hl)
mdaddr2:
	ld hl,02121h
	add hl,de	
	ld (ix+001h),l
	ld (ix+002h),h
	ret	
	
;ALL 16 ADDRESSES TO PROTECT FROM BROKEN PT3 MODULES
spccoms
	dw c_nop
	dw c_gliss
	dw c_portm
	dw c_smpos
	dw c_orpos
	dw c_vibrt
	dw c_nop
	dw c_nop
	dw c_engls
	dw c_pt3_delay
	dw c_nop
	dw c_nop
	dw c_nop
	dw c_nop
	dw c_nop
	dw c_nop

chregs:
	xor a	
	ld (Ampl),a
	bit 0,(ix+015h)
	push hl	
	jp z,ch_exit
	ld (csp_+1),sp
	ld l,(ix+00dh)
	ld h,(ix+00eh)
	ld sp,hl	
	pop de	
	ld h,a	
	ld a,(ix+000h)
	ld l,a	
	add hl,sp	
	inc a	
	cp d	
	jr c,ch_orps
	ld a,e	
ch_orps:
	ld (ix+000h),a
	ld a,(ix+012h)
	add a,(hl)	
	jp p,ch_ntp
	xor a	
ch_ntp:
	cp 060h
	jr c,ch_nok
	ld a,05fh
ch_nok:
	add a,a	
	ex af,af'	
	ld l,(ix+00fh)
	ld h,(ix+010h)
	ld sp,hl	
	pop de	
	ld h,000h
	ld a,(ix+001h)
	ld b,a	
	add a,a	
	add a,a	
	ld l,a	
	add hl,sp	
	ld sp,hl	
	ld a,b	
	inc a	
	cp d	
	jr c,ch_smps
	ld a,e	
ch_smps:
	ld (ix+001h),a
	pop bc	
	pop hl	
	ld e,(ix+008h)
	ld d,(ix+009h)
	add hl,de	
	bit 6,b
	jr z,ch_noac
	ld (ix+008h),l
	ld (ix+009h),h
ch_noac:
	ex de,hl	
	ex af,af'	
	ld l,a	
	ld h,000h
	ld sp,NT_
	add hl,sp	
	ld sp,hl	
	pop hl	
	add hl,de	
	ld e,(ix+006h)
	ld d,(ix+007h)
	add hl,de	
csp_
	ld sp,03131h
	ex (sp),hl	
	xor a	
	or (ix+005h)
	jr z,ch_amp
	dec (ix+005h)
	jr nz,ch_amp
	ld a,(ix+016h)
	ld (ix+005h),a
	ld l,(ix+017h)
	ld h,(ix+018h)
	ld a,h	
	add hl,de	
	ld (ix+006h),l
	ld (ix+007h),h
	bit 2,(ix+015h)
	jr nz,ch_amp
	ld e,(ix+019h)
	ld d,(ix+01ah)
	and a	
	jr z,ch_stpp
	ex de,hl	
ch_stpp:
	sbc hl,de
	jp m,ch_amp
	ld a,(ix+013h)
	ld (ix+012h),a
	xor a	
	ld (ix+005h),a
	ld (ix+006h),a
	ld (ix+007h),a
ch_amp:
	ld a,(ix+002h)
	bit 7,c
	jr z,ch_noam
	bit 6,c
	jr z,ch_amin
	cp 00fh
	jr z,ch_noam
	inc a	
	jr ch_svam
ch_amin:
	cp 0f1h
	jr z,ch_noam
	dec a	
ch_svam:
	ld (ix+002h),a
ch_noam:
	ld l,a	
	ld a,b	
	and 00fh
	add a,l	
	jp p,ch_apos
	xor a	
ch_apos:
	cp 010h
	jr c,ch_vol
	ld a,00fh
ch_vol:
	or (ix+01ch)
	ld l,a	
	ld h,000h
	ld de,VT_
	add hl,de	
	ld a,(hl)	
ch_env:
	bit 0,c
	jr nz,ch_noen
	or (ix+014h)
ch_noen:
	ld (Ampl),a
	bit 7,b
	ld a,c	
	jr z,no_ensl
	rla	
	rla	
	sra a
	sra a
	sra a
	add a,(ix+004h)
	bit 5,b
	jr z,no_enac
	ld (ix+004h),a
no_enac:
	ld hl,AddToEn+1
	add a,(hl)	
	ld (hl),a	
	jr ch_mix
no_ensl:
	rra	
	add a,(ix+003h)
	ld (AddToNs),a
	bit 5,b
	jr z,ch_mix
	ld (ix+003h),a
ch_mix:
	ld a,b	
	rra	
	and 048h
ch_exit:
	ld hl,AYREGS+AR_Mixer
	or (hl)	
	rrca	
	ld (hl),a	
	pop hl	
	xor a	
	or (ix+00ah)
	ret z	
	dec (ix+00ah)
	ret nz	
	xor (ix+015h)
	ld (ix+015h),a
	rra	
	ld a,(ix+00bh)
	jr c,ch_ondl
	ld a,(ix+00ch)
ch_ondl:
	ld (ix+00ah),a
	ret	
play:
	xor a	
	ld (AddToEn+1),a
	ld (AYREGS+AR_Mixer),a
	dec a	
	ld (AYREGS+AR_EnvTp),a
	ld hl,DelyCnt
	dec (hl)	
	jr nz,pl2
	ld hl,ChanA+CHP_NtSkCn
	dec (hl)	
	jr nz,pl1b
AdInPtA:
	ld bc,00101h
	ld a,(bc)	
	and a	
	jr nz,pl1a
	ld d,a	
	ld (ns_base),a
	ld hl,(CrPsPtr)
	inc hl	
	ld a,(hl)	
	inc a	
	jr nz,plnlp
	call checklp
LPosPtr:
	ld hl,02121h
	ld a,(hl)	
	inc a	
plnlp:
	ld (CrPsPtr),hl
	dec a	
	add a,a	
	ld e,a	
	rl d
PatsPtr:
	ld hl,02121h
	add hl,de	
	ld de,(modaddr+1)
	ld (psp_+1),sp
	ld sp,hl	
	pop hl	
	add hl,de	
	ld b,h	
	ld c,l	
	pop hl	
	add hl,de	
	ld (AdInPtB+1),hl
	pop hl	
	add hl,de	
	ld (AdInPtC+1),hl
psp_
	ld sp,03131h
pl1a:
	ld ix,ChanA+12
	call ptdecod
	ld (AdInPtA+1),bc
pl1b:
	ld hl,ChanB+CHP_NtSkCn
	dec (hl)	
	jr nz,pl1c
	ld ix,ChanB+12
AdInPtB:
	ld bc,00101h
	call ptdecod
	ld (AdInPtB+1),bc
pl1c:
	ld hl,ChanC+CHP_NtSkCn
	dec (hl)	
	jr nz,pl1d
	ld ix,ChanC+12
AdInPtC:
	ld bc,00101h
	call ptdecod
	ld (AdInPtC+1),bc
pl1d:
pt3_delay:
	ld a,03eh
	ld (DelyCnt),a
pl2:
	ld ix,ChanA
	ld hl,(AYREGS+AR_TonA)
	call chregs
	ld (AYREGS+AR_TonA),hl
	ld a,(Ampl)
	ld (AYREGS+AR_AmplA),a
	ld ix,ChanB
	ld hl,(AYREGS+AR_TonB)
	call chregs
	ld (AYREGS+AR_TonB),hl
	ld a,(Ampl)
	ld (AYREGS+AR_AmplB),a
	ld ix,ChanC
	ld hl,(AYREGS+AR_TonC)
	call chregs
	ld (AYREGS+AR_TonC),hl
	ld hl,(ns_base_AddToNs)
	ld a,h	
	add a,l	
	ld (AYREGS+AR_Noise),a

AddToEn
	ld a,03eh
	ld e,a	
	add a,a	
	sbc a,a	
	ld d,a	
	ld hl,(EnvBase)
	add hl,de	
	ld de,(CurESld)
	add hl,de	
	ld (AYREGS+AR_Env),hl

	xor a	
	ld hl,CurEDel
	or (hl)	
	jr z,rout_a0
	dec (hl)	
	jr nz,rout
env_del
	ld a,03eh
	ld (hl),a	
ESldAdd:
	ld hl,02121h
	add hl,de	
	ld (CurESld),hl
rout:
	xor a	
rout_a0:
	ld de,0ffbfh
	ld bc,0fffdh
	ld hl,AYREGS
lout:
	out (c),a
	ld b,e	
	outi
	ld b,d	
	inc a	
	cp 00dh
	jr nz,lout
	out (c),a
	ld a,(hl)	
	and a	
	ret m	
	ld b,e	
	out (c),a
	ret	
	
nt_data:
	DB (T_NEW_0-T1_)*2
	DB TCNEW_0-T_
	DB (T_OLD_0-T1_)*2+1
	DB TCOLD_0-T_
	DB (T_NEW_1-T1_)*2+1
	DB TCNEW_1-T_
	DB (T_OLD_1-T1_)*2+1
	DB TCOLD_1-T_
	DB (T_NEW_2-T1_)*2
	DB TCNEW_2-T_
	DB (T_OLD_2-T1_)*2
	DB TCOLD_2-T_
	DB (T_NEW_3-T1_)*2
	DB TCNEW_3-T_
	DB (T_OLD_3-T1_)*2
	DB TCOLD_3-T_

T_

TCOLD_0	DB #00+1,#04+1,#08+1,#0A+1,#0C+1,#0E+1,#12+1,#14+1
	DB #18+1,#24+1,#3C+1,0
TCOLD_1	DB #5C+1,0
TCOLD_2	DB #30+1,#36+1,#4C+1,#52+1,#5E+1,#70+1,#82,#8C,#9C
	DB #9E,#A0,#A6,#A8,#AA,#AC,#AE,#AE,0
TCNEW_3	DB #56+1
TCOLD_3	DB #1E+1,#22+1,#24+1,#28+1,#2C+1,#2E+1,#32+1,#BE+1,0
TCNEW_0	DB #1C+1,#20+1,#22+1,#26+1,#2A+1,#2C+1,#30+1,#54+1
	DB #BC+1,#BE+1,0
TCNEW_1 EQU TCOLD_1
TCNEW_2	DB #1A+1,#20+1,#24+1,#28+1,#2A+1,#3A+1,#4C+1,#5E+1
	DB #BA+1,#BC+1,#BE+1,0

emptysamorn EQU $-1
	DB 1,0,#90 ;delete #90 if you don't need default sample

;first 12 values of tone tables (packed)

T_PACK	DB #06EC*2/256,#06EC*2
	DB #0755-#06EC
	DB #07C5-#0755
	DB #083B-#07C5
	DB #08B8-#083B
	DB #093D-#08B8
	DB #09CA-#093D
	DB #0A5F-#09CA
	DB #0AFC-#0A5F
	DB #0BA4-#0AFC
	DB #0C55-#0BA4
	DB #0D10-#0C55
	DB #066D*2/256,#066D*2
	DB #06CF-#066D
	DB #0737-#06CF
	DB #07A4-#0737
	DB #0819-#07A4
	DB #0894-#0819
	DB #0917-#0894
	DB #09A1-#0917
	DB #0A33-#09A1
	DB #0ACF-#0A33
	DB #0B73-#0ACF
	DB #0C22-#0B73
	DB #0CDA-#0C22
	DB #0704*2/256,#0704*2
	DB #076E-#0704
	DB #07E0-#076E
	DB #0858-#07E0
	DB #08D6-#0858
	DB #095C-#08D6
	DB #09EC-#095C
	DB #0A82-#09EC
	DB #0B22-#0A82
	DB #0BCC-#0B22
	DB #0C80-#0BCC
	DB #0D3E-#0C80
	DB #07E0*2/256,#07E0*2
	DB #0858-#07E0
	DB #08E0-#0858
	DB #0960-#08E0
	DB #09F0-#0960
	DB #0A88-#09F0
	DB #0B28-#0A88
	DB #0BD8-#0B28
	DB #0C80-#0BD8
	DB #0D60-#0C80
	DB #0E10-#0D60
	DB #0EF8-#0E10

; channel data offsets
CHP_PsInOr	equ 0
CHP_PsInSm	equ 1
CHP_CrAmSl	equ 2
CHP_CrNsSl	equ 3
CHP_CrEnSl	equ 4
CHP_TSlCnt	equ 5
CHP_CrTnSl	equ 6
CHP_TnAcc	equ 8
CHP_COnOff	equ 10
CHP_OnOffD	equ 11
;IX for PTDECOD here (+12)
CHP_OffOnD	equ 12
CHP_OrnPtr	equ 13
CHP_SamPtr	equ 15
CHP_NNtSkp	equ 17
CHP_Note	equ 18
CHP_SlToNt	equ 19
CHP_Env_En	equ 20
CHP_Flags	equ 21
 ;Enabled - 0,SimpleGliss - 2
CHP_TnSlDl	equ 22
CHP_TSlStp	equ 23
CHP_TnDelt	equ 25
CHP_NtSkCn	equ 27
CHP_Volume	equ 28

vars
ChanA	ds 29
ChanB	ds 29
ChanC	ds 29


;GlobalVars
DelyCnt	DB 0
CurESld	DW 0
CurEDel	DB 0
ns_base_AddToNs
ns_base	DB 0
AddToNs	DB 0

AR_TonA	equ 0;word 1
AR_TonB	equ 2;word 1
AR_TonC	equ 4;word 1
AR_Noise	equ 6;byte 1
AR_Mixer	equ 7;byte 1
AR_AmplA	equ 8;byte 1
AR_AmplB	equ 9;byte 1
AR_AmplC	equ 10;byte 1
AR_Env	equ 11;word 1
AR_EnvTp	equ 13;byte 1
AR_Size equ 14

AYREGS equ $

VT_	DS 256 ;CreatedVolumeTableAddress

EnvBase	EQU VT_+14

T1_	EQU VT_+16 ;Tone tables data depacked here

T_OLD_1	EQU T1_
T_OLD_2	EQU T_OLD_1+24
T_OLD_3	EQU T_OLD_2+24
T_OLD_0	EQU T_OLD_3+2
T_NEW_0	EQU T_OLD_0
T_NEW_1	EQU T_OLD_1
T_NEW_2	EQU T_NEW_0+24
T_NEW_3	EQU T_OLD_3

NT_	DS 192 ;CreatedNoteTableAddress

;local var
Ampl	EQU AYREGS+AR_AmplC

VAR0END	EQU VT_+16 ;pt3_init zeroes from VARS to VAR0END-1

VARSEND EQU $

MDLADDR EQU $
