package com.meadowmarket.littles;

import java.util.Arrays;
import java.util.function.LongSupplier;

/** One bounded, memory-only SDK trace. No identifiers, wall clock, payloads or rewards. */
final class AdLifecycle {
    static final int STARTED=0,SHOWN=1,IMPRESSION=2,EARNED=3,DISMISSED=4,UNAVAILABLE=5,LOAD_CANCELLED=6,DESTROYED=7;
    static final String[] CODES={"started","shown","impression","earned","dismissed","unavailable","load_cancelled","destroyed"};
    static final int PUBLISHER=1,DEMO=2;
    private final LongSupplier clock;
    private final long origin;
    private final int generation,kind;
    private final long[] times=new long[CODES.length];
    private boolean terminal;
    AdLifecycle(LongSupplier clock,int generation,int kind){if(generation<=0||(kind!=PUBLISHER&&kind!=DEMO))throw new IllegalArgumentException();this.clock=clock;this.generation=generation;this.kind=kind;origin=clock.getAsLong();Arrays.fill(times,-1);times[STARTED]=0;}
    void mark(int code){
        if(code<0||code>=times.length||terminal||times[code]>=0)return;
        times[code]=Math.max(0,clock.getAsLong()-origin);
        if(code>=DISMISSED)terminal=true;
    }
    long[] times(){return times.clone();}
    long sampledMs(){return Math.max(0,clock.getAsLong()-origin);}
    boolean terminal(){return terminal;}
    int generation(){return generation;}
    String kind(){return kind==DEMO?"demo":"publisher";}
}
