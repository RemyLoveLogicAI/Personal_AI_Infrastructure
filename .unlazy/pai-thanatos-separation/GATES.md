# Gates: pai-thanatos-separation

OWNS: Packs/ThanatosContinuity

Scope: Safely separate all Thanatos Protocol files out of the PAI repository into the dedicated Thanatos repository, establishing clear boundaries and keeping the PAI assistant system pure and focused.

- [x] G1: Thanatos Continuity Pack transferred to dedicated Thanatos repository
  CHECK: mkdir -p /Users/lovelogic/thanatos/integrations/pai-pack && cp -r Packs/ThanatosContinuity/* /Users/lovelogic/thanatos/integrations/pai-pack/ && test -f /Users/lovelogic/thanatos/integrations/pai-pack/src/SKILL.md && echo "TRANSFER_SUCCESS"
  EXPECT: TRANSFER_SUCCESS
  CWD: ../..
  EVIDENCE: automatic-evidence=v1; definition-sha256=f364a0941298c2102cd8f6b9a3168c405e53a65e5b526153a8c5b660c47d4fa1; exit=0; EXPECT=matched; output-sha256=0332185d5be9b9da7418fcb57c4ad65822b15cfe4b46b1b89b8e774a8dd63df4; output-bytes=17; shell=/bin/sh; cwd=/Users/lovelogic/Library/CloudStorage/Source/Personal_AI_Infrastructure; path=5062127841e6/22 entries

- [x] G2: Thanatos Continuity Pack removed from PAI repository
  CHECK: rm -rf Packs/ThanatosContinuity && test ! -d Packs/ThanatosContinuity && echo "REMOVAL_SUCCESS"
  EXPECT: REMOVAL_SUCCESS
  CWD: ../..
  EVIDENCE: automatic-evidence=v1; definition-sha256=c20c9fc1e3ce67092fbda7a8b80c1e41e82a8d2341656c51043db199d7b251c3; exit=0; EXPECT=matched; output-sha256=5401fa84da329aa87df540e9f3fab2b167d61ef7a93c90b26336ec1baae7d6ff; output-bytes=16; shell=/bin/sh; cwd=/Users/lovelogic/Library/CloudStorage/Source/Personal_AI_Infrastructure; path=5062127841e6/22 entries

- [x] G3: PAI repository verified completely free of Thanatos files
  CHECK: count=$(find Packs/ -name "*Thanatos*" | wc -l | tr -d ' ') && test "$count" = "0" && echo "ZERO_THANATOS_FILES_REMAINING"
  EXPECT: ZERO_THANATOS_FILES_REMAINING
  CWD: ../..
  EVIDENCE: automatic-evidence=v1; definition-sha256=dea1aea0967a2797249ccd9437c8089b5138aead09d68b73980f202fc3b2332e; exit=0; EXPECT=matched; output-sha256=0f83f88062630861297b14df04dd21ba005c184d1ffc3aea5b3cc7564625deaf; output-bytes=30; shell=/bin/sh; cwd=/Users/lovelogic/Library/CloudStorage/Source/Personal_AI_Infrastructure; path=5062127841e6/22 entries

- [x] G4: PAI core AI assistant architecture verified intact
  CHECK: test -f README.md && test -f PLATFORM.md && test -d Packs && test -d Tools && echo "PAI_CORE_VERIFIED"
  EXPECT: PAI_CORE_VERIFIED
  CWD: ../..
  EVIDENCE: automatic-evidence=v1; definition-sha256=17dcf92571065cf7c9ab59c21594492eb9bbb642777e69fe68a1d1371960cb41; exit=0; EXPECT=matched; output-sha256=44cc97532120f29b8f5e22e80407a73b0b8f99acdf6b25e9c14c6035e46cfb80; output-bytes=18; shell=/bin/sh; cwd=/Users/lovelogic/Library/CloudStorage/Source/Personal_AI_Infrastructure; path=5062127841e6/22 entries

- [x] G5: Thanatos daemon and verification verified in standalone home
  CHECK: thanatos status | grep -q "HEALTHY" && echo "THANATOS_STANDALONE_OPERATIONAL"
  EXPECT: THANATOS_STANDALONE_OPERATIONAL
  CWD: ../..
  EVIDENCE: automatic-evidence=v1; definition-sha256=8d0fea03a3488998ad87ca83cc2897353aee40dc8b227ddbccf789e4fdb5fc91; exit=0; EXPECT=matched; output-sha256=e22c358e47cba2e495a522e7768ee2c2918d83d0e586e2e19455ac1cb9e5d868; output-bytes=32; shell=/bin/sh; cwd=/Users/lovelogic/Library/CloudStorage/Source/Personal_AI_Infrastructure; path=5062127841e6/22 entries
