// Strapi API 설정을 본인의 환경에 맞게 수정하세요.
const STRAPI_API_URL = 'https://api-s694m.strapidemo.com'; // 👈 바로 이 주소입니다! /admin은 제외합니다.
const STRAPI_COLLECTION_API_ID = 'articles'; // 👈 이 값은 아래 2단계에서 확인/설정합니다.

// GitHub API 설정
const GITHUB_API_URL = 'https://api.github.com/repos/9one2/vite2/dispatches'; // VitePress 위키 레포지토리

// 로컬 스토리지에서 토큰 가져오기 (토큰이 없으면 null)
let githubToken = localStorage.getItem('github_token');

// Toast UI Editor 초기화
const Editor = toastui.Editor;
const editorInstance = new Editor({
    el: document.querySelector('#editor'),
    height: '500px',
    initialEditType: 'wysiwyg', // 또는 'markdown'
    previewStyle: 'vertical',   // 또는 'tab'
    usageStatistics: false // 통계 수집 비활성화
});

const titleInput = document.getElementById('title');
const saveButton = document.getElementById('saveButton');
const statusMessage = document.getElementById('statusMessage');

// 토큰 관리를 위한 UI 추가
function createTokenUI() {
    const tokenContainer = document.createElement('div');
    tokenContainer.className = 'token-container';
    tokenContainer.style.marginBottom = '20px';
    
    const label = document.createElement('label');
    label.textContent = 'GitHub 토큰: ';
    label.htmlFor = 'github-token';
    
    const input = document.createElement('input');
    input.type = 'password';
    input.id = 'github-token';
    input.placeholder = 'GitHub 개인 액세스 토큰을 입력하세요';
    input.value = githubToken || '';
    input.style.width = '300px';
    input.style.marginRight = '10px';
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '토큰 저장';
    saveBtn.onclick = function() {
        const token = document.getElementById('github-token').value.trim();
        if (token) {
            localStorage.setItem('github_token', token);
            githubToken = token;
            alert('토큰이 브라우저에 저장되었습니다.');
        } else {
            localStorage.removeItem('github_token');
            githubToken = null;
            alert('토큰이 삭제되었습니다.');
        }
    };
    
    tokenContainer.appendChild(label);
    tokenContainer.appendChild(input);
    tokenContainer.appendChild(saveBtn);
    
    // 컨테이너 요소의 맨 앞에 추가
    const container = document.querySelector('.container');
    container.insertBefore(tokenContainer, container.firstChild);
}

// 페이지 로드 시 토큰 UI 생성
document.addEventListener('DOMContentLoaded', createTokenUI);

saveButton.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const content = editorInstance.getMarkdown(); // 에디터 내용을 마크다운으로 가져옵니다.

    // --- ❗❗❗ 매우 중요한 디버깅 로그 ❗❗❗ ---
    // 브라우저 개발자 도구의 콘솔에서 이 로그를 반드시 확인해주세요.
    console.log('--- 에디터 내용 확인 ---');
    console.log('제목 (title):', title);
    console.log('에디터에서 가져온 내용 (content):', content); // 이 값이 null인지, 빈 문자열인지, 아니면 실제 내용인지 확인!
    console.log('에디터 인스턴스 (editorInstance):', editorInstance);
    // ------------------------------------

    if (!title) {
        displayMessage('제목을 입력해주세요.', 'error');
        return;
    }

    // content가 null이거나 undefined일 경우, 또는 빈 문자열일 경우를 명확히 구분하여 처리
    if (content === null || content === undefined) {
        displayMessage('내용을 가져올 수 없습니다. 에디터 상태를 확인해주세요.', 'error');
        console.error('editorInstance.getMarkdown()이 null 또는 undefined를 반환했습니다.');
        return;
    }
    // 빈 문자열도 내용이 없는 것으로 간주 (필요에 따라 이 조건은 조절 가능)
    if (content.trim() === "") {
        displayMessage('내용을 입력해주세요. (내용이 비어있습니다)', 'error');
        return;
    }

    // Strapi API 엔드포인트
    // 중요: Strapi v4부터 API 엔드포인트는 /api/ 를 포함합니다.
    // 예: http://localhost:1337/api/articles
    const apiUrl = `${STRAPI_API_URL}/api/${STRAPI_COLLECTION_API_ID}`;

    displayMessage('저장 중...', 'info');

    try {
        // 1. Strapi API에 콘텐츠 저장
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 만약 API Token이 필요하다면 여기에 추가 (Bearer Token 등)
                // 'Authorization': 'Bearer YOUR_API_TOKEN'
            },
            body: JSON.stringify({
                data: { // Strapi v4에서는 데이터를 'data' 객체로 감싸야 합니다.
                    title: title,       // "Articles"에 추가한 title 필드
                    content: content    // "Articles"에 추가한 content 필드
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Strapi Error:', errorData);
            throw new Error(`Strapi 저장 실패: ${errorData.error?.message || response.statusText}`);
        }

        const result = await response.json();
        console.log('저장 성공:', result);
        
        // 2. GitHub Actions 워크플로우 트리거 (수정된 부분)
        if (githubToken) {
            try {
                const githubResponse = await fetch(GITHUB_API_URL, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Authorization': `token ${githubToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        event_type: 'strapi-webhook',
                        client_payload: {
                            source: 'editor',
                            contentId: result.data.id,
                            title: title
                        }
                    })
                });
                
                if (githubResponse.status === 204) {
                    console.log('GitHub Actions 워크플로우 트리거 성공!');
                    displayMessage('콘텐츠가 성공적으로 저장되었고, VitePress 위키 빌드가 시작되었습니다!', 'success');
                } else {
                    console.error('GitHub Actions 트리거 실패:', githubResponse.status);
                    displayMessage('콘텐츠는 저장되었지만, 위키 빌드에 실패했습니다. 토큰을 확인해주세요.', 'warning');
                }
            } catch (githubError) {
                console.error('GitHub API 호출 오류:', githubError);
                displayMessage('콘텐츠는 저장되었지만, 위키 빌드에 실패했습니다.', 'warning');
            }
        } else {
            displayMessage('콘텐츠가 저장되었습니다. GitHub 토큰이 없어 위키 빌드는 시작되지 않았습니다.', 'success');
        }
        
        titleInput.value = ''; // 입력 필드 초기화
        editorInstance.setMarkdown(''); // 에디터 내용 초기화

    } catch (error) {
        console.error('저장 중 오류 발생:', error);
        displayMessage(`오류: ${error.message}`, 'error');
    }
});

function displayMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type; // 'success', 'error', 'info'
} 