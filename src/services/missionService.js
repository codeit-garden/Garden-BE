const { PrismaClient } = require('@prisma/client');
const { CustomError, ErrorCodes } = require('../utils/error');
const missionUtils = require('../utils/missionUtils');

const prisma = new PrismaClient();

const uncompletedMission = async (memberId) => {
    try {
      const missions = await prisma.memberMission.findMany({
        where: {
          memberId: Number(memberId),
          completed: false,
        },
        include: {
          mission: {
            include: { flower: true },
          },
        },
        orderBy: {
          mission: { id: "asc" },
        },
      });
  
      const missionList = [];
      
      for (const mission of missions){
        const currentValue = await missionUtils.calculateCurrentValue(memberId, mission);
        const completed = currentValue >= mission.mission.targetValue;
        
        const formatMission = {
            title: mission.mission.title,
            description: mission.mission.description,
            type: mission.mission.type,
            targetValue: mission.mission.targetValue,
            currentValue: currentValue,
            completed,
            flowerName: mission.mission.flower.name,
        };

        //완료된 미션
        if(completed){
            //완료처리
            await prisma.memberMission.update({
                where: {id: mission.id},
                data: {
                    completed: true,
                    lastUpdated: new Date(),
                },
            });
            //꽃 해제
            await missionUtils.unlockFlower(memberId, mission.mission.flower.id);
        }
        missionList.push(formatMission);
      }
      return missionList;
    } catch (error) {
      console.error(error);
      throw new CustomError(ErrorCodes.InternalServerError,"사용자의 미션 목록 조회 중 오류가 발생하였습니다.");
    }
};


//연속 심기 미션 업데이트(로그인시..?)
const updateConsecutivePlantingMission = async(memberId) => {
    // UTC 시간을 KST로 변환 (UTC+9)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const today = new Date(new Date(now.getTime() + kstOffset).setHours(0, 0, 0, 0));
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  
    try{
        // DB의 UTC 시간을 KST 기준으로 조회
        const todayPlantings = await prisma.focusTime.count({           
            where: {
                memberId: Number(memberId),
                createdAt: {
                    // UTC로 변환하여 쿼리
                    gte: new Date(today.getTime() - kstOffset),
                    lt: new Date(today.getTime() + 24 * 60 * 60 * 1000 - kstOffset),
                },
            },
        });

        // 오늘 심은 꽃이 없으면 미션 업데이트하지 않음
        if (todayPlantings === 0) {
            return [];
        }

        //어제 심었는지 확인
        const yesterdayPlantings = await prisma.focusTime.count({
            where: {
                memberId: Number(memberId),
                createdAt: {
                    gte: new Date(yesterday.getTime() - kstOffset),
                    lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - kstOffset),
                },
            },
        });

        const missions = await prisma.memberMission.findMany({
            where: {
                memberId,
                mission: { type: 'CONSECUTIVE_PLANTING' },
                NOT: { lastUpdated: { gte: today } },   //오늘 이미 갱신된 미션 제외
                completed: false,
            },
            include: {mission: { include: { flower: true } } },
        });

        const completedMissions = [];
    
        for (const plantingMission of missions){
            let reset = yesterdayPlantings === 0;       //어제 focusTime이 없으면 reset
            // DB의 UTC 시간을 KST로 변환
            const lastUpdated = plantingMission.lastUpdated ? 
                new Date(plantingMission.lastUpdated.getTime() + kstOffset) : null;
            const startDate = plantingMission.startDate ? 
                new Date(plantingMission.startDate.getTime() + kstOffset) : null;
            
            //날짜 계산 편하게 자정으로 다 맞춤
            //if (lastUpdated) lastUpdated.setHours(0, 0, 0, 0);
            //if (startDate) startDate.setHours(0, 0, 0, 0);

            //reset = false;
            
            //마지막 업데이트가 어제가 아니면 연속심기 초기화
            //if (!lastUpdated || lastUpdated.getTime() !== yesterday.getTime()) {
            //    reset = true;
            //}
            
            if (reset || !startDate) {
                //미션 초기화 또는 새로 시작
                await prisma.memberMission.update({
                    where: {id: plantingMission.id},
                    data: {
                        // KST를 다시 UTC로 변환하여 저장
                        startDate: new Date(today.getTime() - kstOffset),
                        completed: false,
                        lastUpdated: new Date(today.getTime() - kstOffset),
                    },
                });
            } else {
                const days = Math.floor((today - startDate) / (24 * 60 * 60 * 1000)) + 1;
                
                if (days >= plantingMission.mission.targetValue) {
                    //연속심기 미션 완료한 경우
                    await prisma.memberMission.update({
                        where: {id: plantingMission.id},
                        data: {
                            completed: true,
                            // KST를 다시 UTC로 변환하여 저장
                            lastUpdated: new Date(today.getTime() - kstOffset),
                        },
                    });
                    await missionUtils.unlockFlower(memberId, plantingMission.mission.flower.id);
                    completedMissions.push({
                        missionId: plantingMission.id,
                        flower: plantingMission.mission.flower ? {
                            name: plantingMission.mission.flower.name, 
                            FlowerImg: plantingMission.mission.flower.FlowerImg
                        } : null //해당 미션으로 깨지는 꽃이 없는 경우 'null'반환
                    });
                } else {
                    //연속 심기 진행 중이지만 아직 완료되지 않은 경우
                    await prisma.memberMission.update({
                        where: {id: plantingMission.id},
                        data: {
                            // KST를 다시 UTC로 변환하여 저장
                            lastUpdated: new Date(today.getTime() - kstOffset),
                        },
                    });
                }
            }
        }
        //console.log(completedMissions);     //점검용
        return completedMissions;
    } catch(error) {
        console.error(error);
        throw new CustomError(ErrorCodes.InternalServerError, '연속 심기 미션 업데이트 중 오류가 발생하였습니다.');
    }
};
  

//집중 시간 미션(집중 시간 저장 시)
const updateFocusTimeMission = async(memberId) => {
    try{
        //현재까지의 총 누적 집중시간
        const totalFocusedTime = await missionUtils.calculateFocusTimeMissionValue(memberId);

        //완료되지 않은 집중시간 미션 조회
        const missions = await prisma.memberMission.findMany({
        where: {
            memberId,
            mission: { type: 'FOCUS_TIME'},
            completed: false
        },
        include: {mission: { include: { flower: true } } },
        });
    
        const completedMissions = [];

        for (const focusMission of missions){
            if(totalFocusedTime >= focusMission.mission.targetValue){
                await prisma.memberMission.update({
                    where: {id: focusMission.id},
                    data: {completed: true},
                });
                await missionUtils.unlockFlower(memberId, focusMission.mission.flower.id);
                completedMissions.push({
                    missionId: focusMission.id,
                    flower: focusMission.mission.flower?
                    {
                        name: focusMission.mission.flower.name, 
                        FlowerImg: focusMission.mission.flower.FlowerImg
                    } : null
                });
            }
        }
        return completedMissions;
    }catch(error){
        throw new CustomError(ErrorCodes.InternalServerError, '집중시간 미션 업데이트 중 오류가 발생하였습니다.');
    }
};


// 심은 꽃 미션(새로운 꽃 심을 경우-집중 시간 저장 시)
const updateTotalFlowerMission = async(memberId) => {
    try{
        const cntUniqueFlowers = missionUtils.calculateTotalFlowersMissionValue(memberId);  //심은 꽃 개수
    
        const flowerMissions = await prisma.memberMission.findMany({
        where: {
            memberId,
            mission: { type: 'TOTAL_FLOWERS'},
            completed: false,
        },
        include: {mission: { include: { flower: true } } },
        });

        const completedMissions = [];
    
        for (const flowerMission of flowerMissions){
            if(cntUniqueFlowers >= flowerMission.mission.targetValue){
                await prisma.memberMission.update({
                    where: { id: flowerMission.id },
                    data: { completed: true },
                });
                await missionUtils.unlockFlower(memberId, flowerMission.mission.flower.id);
                completedMissions.push({
                    missionId: flowerMission.id,
                    flower: flowerMission.mission.flower?
                    {
                        name: flowerMission.mission.flower.name, 
                        FlowerImg: flowerMission.mission.flower.FlowerImg
                    } : null
                });
            }
        }
        return completedMissions;
    }catch(error){
        throw new CustomError(ErrorCodes.InternalServerError, '심은 꽃 미션 업데이트 중 오류가 발생하였습니다.');
    }
};



//처음 가입한 사람의 경우 미션 초기 할당
const setupMission= async(memberId) => {
    try{
        const missions = await prisma.mission.findMany({
            select: {id: true}
        });

        if(missions.length === 0){
            throw new CustomError(ErrorCodes.NotFound, '할당할 미션이 없습니다.');
        }

        //새로운 멤버에게 모든 미션 자동 할당
        await prisma.memberMission.createMany({
            data: missions.map(mission=> ({
                memberId,
                missionId: mission.id,
                startDate: new Date(),
                lastUpdated: new Date()
            }))
        });

        console.log('미션 초기할당이 완료되었습니다');      //확인용
    }catch(error){
        console.error('미션 초기 생성 중 오류:', error);
        throw new CustomError(ErrorCodes.InternalServerError, '미션 초기 생성 중 오류가 발생하였습니다.');
    }
};


module.exports = {
    uncompletedMission,
    updateConsecutivePlantingMission,
    updateTotalFlowerMission,
    updateFocusTimeMission,
    setupMission,
}
