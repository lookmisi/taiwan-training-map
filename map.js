// 當文件加載完成後再初始化地圖
document.addEventListener('DOMContentLoaded', function() {
    console.log('開始初始化地圖...');
    
    // 初始化地圖，設置中心點在台灣中心位置
    const map = L.map('map').setView([23.5, 121], 8);

    // 添加OpenStreetMap圖層
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // 從經緯度字串取得座標
    function getCoordinatesFromString(coordString) {
        if (!coordString) {
            console.log('經緯度字串為空');
            return null;
        }
        try {
            // 移除所有引號和多餘的空格
            const cleanString = coordString.replace(/["']/g, '').trim();
            console.log('處理經緯度字串:', cleanString);
            
            // 檢查是否包含經度和緯度
            if (!cleanString.includes(',')) {
                console.log('經緯度字串格式錯誤，缺少逗號分隔符');
                return null;
            }

            // 分割並解析座標
            const parts = cleanString.split(',');
            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());
            
            console.log('解析後的座標:', lat, lng);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                return [lat, lng];
            }
            console.log('無效的座標值');
            return null;
        } catch (error) {
            console.error('解析經緯度時發生錯誤:', error);
            return null;
        }
    }

    // 格式化系統帳號
    function formatAccountNumber(account) {
        if (!account) return '無';
        
        try {
            let numStr = String(account);
            
            // 處理科學記號格式
            if (numStr.includes('E') || numStr.includes('e')) {
                const num = Number(account);
                if (!isNaN(num)) {
                    numStr = num.toFixed(0);
                }
            }
            
            // 移除非數字字元（包括小數點）
            numStr = numStr.replace(/[^\d]/g, '');
            
            // 如果數字為空，返回 '無'
            if (!numStr) return '無';
            
            // 如果數字超過12位，取後12位
            if (numStr.length > 12) {
                numStr = numStr.slice(-12);
            }
            
            // 在前方補0直到達到12位數
            while (numStr.length < 12) {
                numStr = '0' + numStr;
            }
            
            return numStr;
        } catch (error) {
            console.error('格式化系統帳號時發生錯誤:', error, '原始值:', account);
            return '無法顯示';
        }
    }

    // 建立標記群組
    const markers = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: true,
        zoomToBoundsOnClick: true
    });

    let institutionsData = [];
    let filteredData = [];
    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('category-select');
    const resultCount = document.getElementById('result-count');
    let currentFilter = '';
    let currentCategory = '';
    let institutionListElement;
    let activeMarker = null;
    let activeListItem = null;

    // 新增管理等級和技術等級的篩選選擇器
    const managementSelect = document.createElement('select');
    managementSelect.id = 'management-select';
    managementSelect.innerHTML = '<option value="">所有管理等級</option>';
    document.getElementById('controls').insertBefore(managementSelect, resultCount);

    const technicalSelect = document.createElement('select');
    technicalSelect.id = 'technical-select';
    technicalSelect.innerHTML = '<option value="">所有技術等級</option>';
    document.getElementById('controls').insertBefore(technicalSelect, resultCount);

    console.log('開始讀取CSV檔案...');

    // CSV 檔案路徑 - 簡化版本，直接使用相對路徑
    const csvPath = '教育訓練單位總表.csv';
    console.log('使用的CSV檔案路徑:', csvPath);
    
    // 使用 fetch API 讀取CSV檔案 - 簡化版，移除 Electron 相關代碼
    fetch(csvPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(csv => {
            console.log('成功讀取CSV資料');
            processCsvData(csv);
        })
        .catch(error => {
            console.error('讀取CSV檔案發生錯誤:', error);
            resultCount.textContent = '讀取資料時發生錯誤';
        });

    // CSV 資料處理函數
    function processCsvData(csvData) {
        console.log('開始處理CSV資料...');
        try {
            // 移除 BOM 標記和處理換行符
            const cleanCsv = csvData.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
            
            // 解析CSV資料
            const rows = cleanCsv.split('\n').filter(row => row.trim());
            console.log('CSV總行數:', rows.length);
            
            // 檢查標題行
            const headers = rows[0].split(',');
            console.log('CSV檔案標題:', headers);

            // 跳過標題行
            institutionsData = rows.slice(1).map(row => {
                // 使用正則表達式來正確分割 CSV，處理引號內的逗號
                const columns = row.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g).map(col => 
                    col.replace(/^"|"$/g, '').trim()
                );
                
                const item = {
                    序: columns[0],
                    類別: columns[1],
                    系統帳號: columns[2],
                    單一職訓機構: columns[3],
                    職訓機構名稱: columns[4],
                    管理: columns[5],
                    技術: columns[6],
                    主管機關: columns[7],
                    負責人職稱: columns[8],
                    負責人: columns[9],
                    電話: columns[10],
                    信箱: columns[11],
                    地址: columns[12],
                    地址經緯度: columns[13]
                };

                // 檢查必要欄位
                if (!item.職訓機構名稱 || !item.地址經緯度) {
                    console.log('發現無效的資料項目:', item);
                }

                return item;
            }).filter(item => {
                const isValid = item.職訓機構名稱 && item.地址經緯度;
                return isValid;
            });

            console.log('成功解析資料筆數:', institutionsData.length);
            if (institutionsData.length > 0) {
                console.log('第一筆資料樣本:', institutionsData[0]);
            }

            // 初始化類別選擇
            const categories = [...new Set(institutionsData.map(item => item.類別))];
            categorySelect.innerHTML = '<option value="">所有類別</option>';
            categories.forEach(category => {
                if (category) {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categorySelect.appendChild(option);
                }
            });

            // 定義等級的順序
            const levelOrder = ['優等', '甲等', '乙等', '丙等', '丁等', '無', '乙等(僅檔案紀錄)'];
            
            // 初始化管理等級選擇，按照指定順序
            managementSelect.innerHTML = '<option value="">所有管理等級</option>';
            // 從數據中獲取所有不重複的管理等級
            const uniqueManagementLevels = [...new Set(institutionsData.map(item => item.管理))];
            console.log('管理等級唯一值:', uniqueManagementLevels); // 調試用
            
            // 按指定順序添加選項
            levelOrder.forEach(level => {
                if (uniqueManagementLevels.includes(level)) {
                    const option = document.createElement('option');
                    option.value = level;
                    option.textContent = level;
                    managementSelect.appendChild(option);
                }
            });
            
            // 確保所有唯一值都被添加，防止缺少選項
            uniqueManagementLevels.forEach(level => {
                if (level && !levelOrder.includes(level)) {
                    console.log('發現未在預定義順序中的管理等級:', level);
                    const option = document.createElement('option');
                    option.value = level;
                    option.textContent = level;
                    managementSelect.appendChild(option);
                }
            });

            // 初始化技術等級選擇，按照指定順序
            technicalSelect.innerHTML = '<option value="">所有技術等級</option>';
            // 從數據中獲取所有不重複的技術等級
            const uniqueTechnicalLevels = [...new Set(institutionsData.map(item => item.技術))];
            console.log('技術等級唯一值:', uniqueTechnicalLevels); // 調試用
            
            // 按指定順序添加選項
            levelOrder.forEach(level => {
                if (uniqueTechnicalLevels.includes(level)) {
                    const option = document.createElement('option');
                    option.value = level;
                    option.textContent = level;
                    technicalSelect.appendChild(option);
                }
            });
            
            // 確保所有唯一值都被添加，防止缺少選項
            uniqueTechnicalLevels.forEach(level => {
                if (level && !levelOrder.includes(level)) {
                    console.log('發現未在預定義順序中的技術等級:', level);
                    const option = document.createElement('option');
                    option.value = level;
                    option.textContent = level;
                    technicalSelect.appendChild(option);
                }
            });

            // 設置搜尋和篩選事件
            searchInput.addEventListener('input', updateFilters);
            categorySelect.addEventListener('change', updateFilters);
            managementSelect.addEventListener('change', updateFilters);
            technicalSelect.addEventListener('change', updateFilters);

            // 顯示所有資料
            filterData();
            displayMarkers();
        } catch (error) {
            console.error('處理CSV資料時發生錯誤:', error);
            resultCount.textContent = '處理資料時發生錯誤';
        }
    }

    institutionListElement = document.getElementById('institution-list');

    // 更新篩選器
    function updateFilters() {
        currentFilter = searchInput.value.trim().toLowerCase();
        currentCategory = categorySelect.value;
        filterData();
        displayMarkers();
        updateInstitutionList(); // 新增：更新列表
    }

    // 更新機構列表
    function updateInstitutionList() {
        institutionListElement.innerHTML = '';
        
        filteredData.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'institution-item';
            
            const content = `
                <div class="institution-number">#${index + 1}</div>
                <div class="institution-name">${item.職訓機構名稱}</div>
                <div class="institution-details">
                    ${item.類別} | ${item.管理 || '無'} | ${item.技術 || '無'}
                </div>
            `;
            
            listItem.innerHTML = content;
            
            // 點擊列表項目時觸發
            listItem.addEventListener('click', () => {
                const coordinates = getCoordinatesFromString(item.地址經緯度);
                if (coordinates) {
                    // 移除之前的活動狀態
                    if (activeListItem) {
                        activeListItem.classList.remove('active');
                    }
                    
                    // 設置新的活動狀態
                    listItem.classList.add('active');
                    activeListItem = listItem;

                    // 找到對應的標記並觸發點擊
                    markers.eachLayer((marker) => {
                        const markerLatLng = marker.getLatLng();
                        if (markerLatLng.lat === coordinates[0] && markerLatLng.lng === coordinates[1]) {
                            // 平滑移動到標記位置
                            map.setView(coordinates, 16, {
                                animate: true,
                                duration: 1
                            });
                            marker.openPopup();
                        }
                    });

                    // 確保列表項目在視圖中
                    listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
            
            institutionListElement.appendChild(listItem);
        });
    }

    // 過濾資料函數
    function filterData() {
        const managementLevel = managementSelect.value;
        const technicalLevel = technicalSelect.value;

        filteredData = institutionsData.filter(item => {
            // 根據類別過濾
            const matchCategory = !currentCategory || item.類別 === currentCategory;

            // 根據管理等級過濾
            const matchManagement = !managementLevel || item.管理 === managementLevel;

            // 根據技術等級過濾
            const matchTechnical = !technicalLevel || item.技術 === technicalLevel;

            // 根據搜尋關鍵字過濾
            let matchSearch = true;
            if (currentFilter) {
                matchSearch = (
                    (item.職訓機構名稱 && item.職訓機構名稱.toLowerCase().includes(currentFilter)) ||
                    (item.地址 && item.地址.toLowerCase().includes(currentFilter)) ||
                    (item.類別 && item.類別.toLowerCase().includes(currentFilter)) ||
                    (item.主管機關 && item.主管機關.toLowerCase().includes(currentFilter))
                );
            }

            return matchCategory && matchManagement && matchTechnical && matchSearch;
        });

        // 更新結果計數
        resultCount.textContent = `共 ${filteredData.length} 筆結果`;
    }

    // 顯示標記
    function displayMarkers() {
        console.log('開始顯示標記點...');
        
        // 清除現有標記
        markers.clearLayers();
        
        // 設置標記點樣式
        const defaultIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div class="marker-icon"></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        let validMarkersCount = 0;
        const bounds = L.latLngBounds();

        // 為當前頁的資料添加標記
        filteredData.forEach((item, index) => {
            const coordinates = getCoordinatesFromString(item.地址經緯度);
            if (coordinates) {
                validMarkersCount++;
                
                const marker = L.marker(coordinates, { icon: defaultIcon });
                
                // 標記點彈出資訊
                const popupContent = `
                    <div class="popup-content">
                        <h3>${item.職訓機構名稱}</h3>
                        <table class="info-table">
                            <tr>
                                <td>類別：</td>
                                <td>${item.類別 || '無'}</td>
                            </tr>
                            <tr>
                                <td>系統帳號：</td>
                                <td>${formatAccountNumber(item.系統帳號)}</td>
                            </tr>
                            <tr>
                                <td>管理等級：</td>
                                <td>${item.管理 || '無'}</td>
                            </tr>
                            <tr>
                                <td>技術等級：</td>
                                <td>${item.技術 || '無'}</td>
                            </tr>
                            <tr>
                                <td>主管機關：</td>
                                <td>${item.主管機關 || '無'}</td>
                            </tr>
                            <tr>
                                <td>負責人：</td>
                                <td>${item.負責人職稱 || ''} ${item.負責人 || '無'}</td>
                            </tr>
                            <tr>
                                <td>電話：</td>
                                <td>${item.電話 || '無'}</td>
                            </tr>
                            <tr>
                                <td>信箱：</td>
                                <td>${item.信箱 || '無'}</td>
                            </tr>
                            <tr>
                                <td>地址：</td>
                                <td>${item.地址 || '無'}</td>
                            </tr>
                        </table>
                    </div>
                `;
                
                marker.bindPopup(popupContent, {
                    className: 'custom-popup',
                    maxWidth: 300
                });

                // 當標記被點擊時
                marker.on('click', () => {
                    // 移除之前列表項目的活動狀態
                    if (activeListItem) {
                        activeListItem.classList.remove('active');
                    }
                    
                    // 找到對應的列表項目並設置活動狀態
                    const listItems = institutionListElement.getElementsByClassName('institution-item');
                    if (listItems[index]) {
                        listItems[index].classList.add('active');
                        activeListItem = listItems[index];
                        // 確保列表項目在視圖中
                        listItems[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                });
                
                markers.addLayer(marker);
                bounds.extend(coordinates);
            }
        });

        console.log('有效標記點數量:', validMarkersCount);

        // 將標記群組添加到地圖
        map.addLayer(markers);

        // 調整地圖視圖以顯示所有標記
        if (validMarkersCount > 0) {
            console.log('調整地圖視圖到標記範圍');
            map.fitBounds(bounds.pad(0.1));
        } else {
            console.log('無有效標記點，顯示預設視圖');
            map.setView([23.5, 121], 8);
        }

        // 更新機構列表
        updateInstitutionList();
    }
});