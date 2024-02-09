---
title: Promise와 async,await가 혼용된 함수 리팩토링하기
description: Promise와 async, await는 서로 혼용될 가능성이 농후한 자바스크립트의 비동기 함수를 다루는 방법이며, 이를 혼용하면 가독성을 떨어뜨릴 수 있다. 혼용할 때 오는 문제점과 이에 대한 해결점을 제시해본다.
date : '2024-02-09T16:25:00Z'
---

API 호출, Data Access, File I/O 등, 자바스크립트에서는 비동기 함수를 다룰 일이 많다. 특히 기존 레거시 코드에서 `Promise`를 사용하다가 새로 들어온 개발자가 `async/await`와 혼용하여 사용하는 경우도 흔하지 않게 볼 수 있다.
   
프로젝트 개발 전, `EsLint`과 같은 코딩 컨벤션 툴로 이를 강제할 수는 있겠지만, 만약 이에 대한 명확한 결정 없이 프로젝트가 시작된다면 다음과 같은 코드를 작성하는게 문제가 되지 않는다.

- 비밀번호를 초기화하는 데이터 접근 함수
> 일부 공개할 수 없는 부분은 제외했다.
 ```js
const InitPassword = (user_id, hashed_password) => {
    return new Promise(async (resolve, reject) => {
        try {
            const sql = '<UPDATE QUERY>'
            
            const bind = [user_id, hashed_password];
          
            const result = await DBClient(sql, bind);
            
            if (result.affectedRows === 0)
                reject({
                    success: false,
                    message: '비밀번호 초기화 에러'
                });
            else resolve();
        } catch (error) {
            reject({
                success: false,
                message: '비밀번호 초기화 에러'
            });
        }
    });
};
```
위와 같은 코드는 문제 없이 동작한다. 하지만 좀 더 이쁘게 만들어 볼 수 있을 것 같다.
   
위의 코드의 문제점은 무엇인지 알아보기 전에 javascript에서 비동기 함수를 다루는 세 가지 방법을 왜 쓰는지 살펴보자.

---

# `CallBack`에서 `Promise`, `Promise`에서 `async`/`await`
자바스크립트에서 비동기 함수를 다루는 세 가지 방법의 목적은 다음과 같다.

> 난 순서가 보장되지 않는 비동기 함수를 동기 함수처럼 순서를 보장하고 싶어

비동기 함수는 병렬 처리로 시스템 자원을 효율적으로 쓸 수 있다는 장점이 있지만, 비동기 함수 요청의 결과의 순서를 보장할 수 없다는 단점이 있다. 이러한 문제를 해결하기 위해 처음 등장한 것이 `CallBack`이다.

## `CallBack`
가장 초창기의 비동기를 다루는 방식이다.
   
그 유명한 Callback Hell(콜백 지옥)의 원인은 다음과 같이 **비동기 함수 실행 시 결과값 반환을 콜백 함수의 매개변수에 의존한다**는 것이다.

```js
A((resultA) => {
    B(resultA, (resultB) => {
        C(resultB,(resultC) => {
            D(resultC, (resultD) => {
                E(resultD, (resultF) => {
                    //...
                })
            })
        })
    })
})

```
n번째 비동기 함수의 매개변수로 n+1번째 콜백 함수를 실행하므로써, 비동기 함수의 결과값을 순차적으로 사용할 수는 있었지만, **가독성이 현저히 떨어진다**.

또한, 비동기 함수를 실행할 때의 성공, 실패 여부를 `try~catch` 방식이 아닌, 매개변수를 통해 `error`를 넘겨주는 방식으로 처리해야 한다.

- PDF를 추출하는 레거시 라이브러리를 사용할 때(`pdftotext`), 예외 처리
```js
const extractPDF = (pdf_upload_path, callback) => {
  pdftotext.pdfToText(pdf_upload_path, {}, (err, data) => {
    // 추출 실패 시
    if (err) {
      return callback(err)
    }
    // 추출 성공 시
    callback(null, data)
  })
}

extractPDF(pdf_upload_path, (err,  data) => {
  if(err) { // 비동기 함수가 실패했을 경우
    console.log(err.message);
    return;
  }
  
  console.log(data); // 비동기 함수가 성공적으로 결과를 반환할 경우
})

```
위와 같은 문제점으로 인해, 현재는 거의 사용되지 않는 방식이지만, `Callback`으로 작성된 라이브러리를 사용할 때, 필요할 수 있으므로 반드시 알아둬야할 개념이다.

## `Promise`

`Callback` 방식의 문제점을 해결하기 위해 `Promise`가 등장했다. `Promise`는 비동기 함수를 다음과 같이 세 가지 상태로 구분한다.

- Pending: 대기 상태(이행하지도, 거부하지도 않은 상태)
- Fulfilled: 이행 상태(연산에 성공함)
- Rejected:  실패 상태(연산에 실패함)

![img.png](img.png)

비동기 함수가 성공적으로 처리되었을 때, 중간에 모종의 이유로 실패했을 때의 예외 처리를 `then`과 `catch`를 통헤 `Callback` 방식 보다 명시적으로 처리할 수 있다


- PDF 추출 로직을 Promise로 변경
```js
const extractPDf = (pdf_upload_path) => {
  return new Promise((resolve, reject) =>  {
    pdftotext.pdfToText(pdf_upload_path, {}, (err, data) => {
      //추출 실패 시
      if(err) {
        return reject(err) // Pending 상태의 Promise를 실패 상태(Rejected)로 전환
      }
      //추출 성공 시
      resolve(data) // Pending 상태의 Promise를 이행 상태(Fulfilled)로 전환
    })
  })
}

extractPDF()
  .then(data => console.log(data)) // 비동기 함수가 성공적으로 이행(Fulfilled)되었을 경우
  .catch(err => console.error(err.message)) // 처리 도중 예외가 발생(Rejected)했을 경우
```

`Promise`의 강점은, 여러 개의 비동기 함수를 다룰 때 나타난다. 다음과 같이 `메서드 체이닝(Method Chaining)` 방식으로 여러 개의 콜백 함수 또는 `Promise`를 순차적으로 사용할 수 있다.

- PDF를 추출하고, 분석하여 응답하는 Express Router
```js
const extractPDF = (pdf_upload_path) => {
    return new Promise((resolve, reject) =>  {
        pdftotext.pdfToText(pdf_upload_path, {}, (err, data) => {
            //추출 실패 시
            if(err) {
                return reject(err) // Pending 상태의 Promise를 실패 상태(Rejected)로 전환
            }
            //추출 성공 시
            resolve(data) // Pending 상태의 Promise를 이행 상태(Fulfilled)로 전환
        })
    })
}

const analyzePDF = (extracted_data) => {
    return new Promise((resolve, reject) => {
        //... 추출된 pdf 데이터 분석 및 예외 처리
    })
}

router.get('/extract', (req, res) => {
    const { pdf_upload_path } = req.body;
    
    extractPDF(pdf_upload_path)
        .then(extracted_data => analyzePDF(extracted_data)) // 메서드 체이닝 방식으로 순차적 Promise 적용
        .then(analyzed_data => res.status(200).json(analyzed_data))
        .catch(error => res.status(500).json(error.message));
})

```
> 일반적으로 `then()`의 매개변수는 새로운 `Promise`의 인스턴스를 생성하기 위해 사용하지만, 반드시 `Promise`가 아닌 콜백 함수를 매개변수로 사용해도 된다.

하지만 이렇게 편해보이는 `Promise` 또한 단점이 존재하는데, 콜백 지옥에 이은 `then()` 지옥이다.

```js
Promise1()
  .then(Promise2)
  .then(Promise3)
  .then(Promise4)
  //...
  .catch(error => console.log(error.message));

```
 이러한 `Promise` 의 방식은 우리들이 일반적으로 배웠던 동기 함수의 절차적 프로그래밍 방식과 매우 다르다. 우리는 `try~catch`로 예외를 처리하며, 함수 내부에서 비동기 함수를 신경쓰지 않고, 절차적으로 함수의 결과값을 받아와 사용하고 싶다.
    
`Promise`는 `Callback`보다는 충분히 가독성이 좋지만, 우리가 일반적으로 동기 함수를 다루는 방식과 유사하게 비동기 함수를 다루고 싶다면 다음의 `async/await`를 고려해볼 수 있다.

## `async/await`
`Promise`의 Chaning Method 방식의 단점을 보완하기 위해 등장했다. 위의 PDF를 추출하고, 분석하는 Promise를 가져와 적용해보자.
```js
const extractPDF = (pdf_upload_path) => {
  return new Promise((resolve, reject) =>  {
    pdftotext.pdfToText(pdf_upload_path, {}, (err, data) => {
      if(err) {
        return reject(err) 
      }
      resolve(data) 
    })
  })
}

const analyzePDF = (extracted_data) => {
  return new Promise((resolve, reject) => {
    //... 추출된 PDF 데이터 분석 및 예외 처리
  })
}

```
### `await`

`await` 가 붙을 수 있는 함수는 반드시 **`Promise`를 반환하는 함수여야 한다**. `await`가 붙은 프로미스는 상태가 결정될 때(`Fulfilled` 혹은 `Rejected`)까지 다음 명령이 실행되지 않는다. 또한, 우리들이 일반적으로 사용했던 `try~catch` 방식으로 예외를 명시적으로 처리할 수 있다.

이 때, 중요한 것은 `Promise`의 상태가 `Rejected`라면 예외로 처리되어 `catch` 구문으로 들어가며, `Fulfilled` 상태라면 정상적으로 다음 명령을 수행한다. 또한 일반적인 `try~catch`의 명시적 예외 처리를 함께 사용할 수 있다.

```js
const initPDFExtract = async (pdf_upload_path) => {
    try {
        if (!pdf_upload_path) {
            throw new Error(`PDF 경로를 입력해주세요. pdf_upload_path: ${pdf_upload_path}`) // throw 키워드를 사용한 명시적 에러 처리
        }

        const extracted_data = await extractPDF(pdf_upload_path); // 만약 추출 중 예외(Reject)가 생긴다면, catch 구문으로 이동
        const analyzed_data = await analyzePDF(extracted_data);
        return analyzed_data;
    } catch (e) {
        errorhandler(e)
    }
}
```

## `async`

`asnyc`를 적용한 함수는 반드시  `Promise`를 결과값으로 반환한다. 또한 `await` 키워드를 사용하고 싶다면, 반드시 `async` 함수 내부여야만 한다. **이 함수는 이제 내부에서 비동기 함수를 사용한다**고 명시해주는 것이다.
   
`async` 함수 내부에서의 `return`은 이제 일반 함수의 `return`의 의미와 달라지게 된다.
- `async` 함수 내부에서 `return` 키워드로 반환되는 값은  `Promise.resolve()`의 매개변수 된다.
- `async` 함수 내부에서 `return` 키워드가 없다면, 내부 로직만을 처리하는 `Promise`를 반환한다.

---

# 본론으로 돌아와서
비동기 함수를 순차적으로 다루는 3가지 방법을 알아보았다. 이제 처음에 보았던 코드를 리팩토링 해보자.

```js
const InitPassword = (user_id, hashed_password) => {
    return new Promise(async (resolve, reject) => {
        try {
            const sql = '<UPDATE QUERY>'
            
            const bind = [user_id, hashed_password];
          
            const result = await DBClient(sql, bind);
            
            if (result.affectedRows === 0)
                reject({
                    success: false,
                    message: '비밀번호 초기화 에러'
                });
            else resolve();
        } catch (error) {
            reject({
                success: false,
                message: '비밀번호 초기화 에러'
            });
        }
    });
};
```
위의 코드의 문제는 다음과 같다.

## [문제 1] `Promise` 매개변수로 또 다른 `Promise`를 사용
`async` 함수는 `Promise`를 반환한다. 위의 코드는, `resolve`, `reject`를 매개변수로 하는 함수를 프로미스의 매개변수로 사용하면서 동시에 `async` 함수를 붙였다. 즉 **이중으로 `Promise`를 사용**한 것이다. 내부적으로 `await`를 사용하기 위해 그랬을 것이라고 예측할 수 있다.
   
이제 우리는 `async` 키워드를 붙이면, `Promise` 인스턴스를 명시적으로 `return`하지 않아도 된다는 것을 안다. 다음과 같이 바꿀 수 있다.

```js
const InitPassword = async (user_id, hashed_password) => {
        try {
            const sql = '<UPDATE QUERY>'
            
            const bind = [user_id, hashed_password];
          
            const result = await DBClient(sql, bind);
            
            if (result.affectedRows === 0)
                Promise.reject({  // Promise의 reject 함수 직접 호출
                    success: false,
                    message: '비밀번호 초기화 에러'
                });
            else Promise.resolve(); // Promise의 resolve 함수 직접 호출
        } catch (error) {
            Promise.reject({
                success: false,
                message: '비밀번호 초기화 에러'
            });
        }
};
```
## [문제 2] Promise 클래스 의존

`async` 함수가 `Promise` 클래스를 의존하면 안된다는 것이 아니다. 현재 `async` 함수는 `resolve`, `reject`가 내부적으로 처리되므로, 코드로 명시할 필요가 없어진다. 다음과 같이 코드를 바꿀 수 있다.

```js
const InitPassword = async (user_id, hashed_password) => {
        try {
            const sql = '<UPDATE QUERY>'
            
            const bind = [user_id, hashed_password];
          
            const result = await DBClient(sql, bind);
            
            if(result.affectedRows === 0) {
                throw new Error('비밀번호 초기화 에러')
            }
        } catch (error) {
            errorHandler(error);
        }
};
```

여기에 더해, 매개변수가 `Falsy`값 인 경우의 예외 처리 등을 추가로 할 수 있겠지만 주제를 벗어난 내용이므로 진행하지 않는다.

## `Promise` 만을 사용한 리팩토링
위의 코드가 더 보기 힘들 수도 있을 독자를 위해 `Promise`만을 사용한 리팩토링 방법을 다음과 같이 작성해보았다.

```js
const InitPassword = (user_id, hashed_password) => {
    return new Promise((resolve, reject) => {
        const sql = '<UPDATE QUERY>'
        const bind = [user_id, hashed_password];

        DBClient(sql, bind)
            .then(result => {
                if(result.affectedRows === 0) {
                    reject(new Error('비밀번호 초기화 에러'))
                }
            })
            .catch(error => {
                reject(error);
            })
    });
};
```

> 필자가 작성한 리팩토링 방식이 모든 개발팀에 적용될 수 있는 것은 아니다. 반드시 팀의 코딩 컨벤션을 따르는 것이 우선이며, 그 외의 리팩토링은 자제하는 것이 좋다.

# 참고글
- [Quora](https://www.quora.com/What-are-the-advantages-and-disadvantages-of-using-promises-in-JavaScript)
- [MDN Web Docs](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise)